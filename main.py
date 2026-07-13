import json
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import scheduler
from database import engine, Base, get_db

# 初始化資料庫 Table
Base.metadata.create_all(bind=engine)

app = FastAPI(title="國小單雙週排課系統 API")

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config() -> schemas.SystemConfig:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return schemas.SystemConfig(**data)
    return schemas.SystemConfig()

def save_config(config: schemas.SystemConfig):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)

@app.on_event("startup")
def sync_classes_on_startup():
    config = load_config()
    # 使用 contextmanager 或手動 close，get_db 是 generator
    db_gen = get_db()
    db = next(db_gen)
    try:
        # Sync config classes to DB
        for c in config.classes:
            c_code = str(c.code) if c.code is not None else None
            existing = db.query(models.Class).filter(models.Class.name == c.name).first()
            if not existing:
                new_class = models.Class(code=c_code, name=c.name, grade=c.grade)
                db.add(new_class)
            else:
                existing.code = c_code
                existing.grade = c.grade
        db.commit()
    finally:
        db.close()

# --- 基礎資料 API: Teachers ---
@app.post("/api/teachers", response_model=schemas.Teacher)
def create_teacher(teacher: schemas.TeacherCreate, db: Session = Depends(get_db)):
    db_teacher = models.Teacher(
        name=teacher.name,
        is_tutor=teacher.is_tutor
    )
    db_teacher.unavailable_slots = teacher.unavailable_slots
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

@app.get("/api/teachers", response_model=List[schemas.Teacher])
def get_teachers(db: Session = Depends(get_db)):
    return db.query(models.Teacher).all()

# --- 基礎資料 API: Classrooms ---
@app.post("/api/classrooms", response_model=schemas.Classroom)
def create_classroom(classroom: schemas.ClassroomCreate, db: Session = Depends(get_db)):
    db_classroom = models.Classroom(**classroom.model_dump())
    db.add(db_classroom)
    db.commit()
    db.refresh(db_classroom)
    return db_classroom

@app.get("/api/classrooms", response_model=List[schemas.Classroom])
def get_classrooms(db: Session = Depends(get_db)):
    # 防呆機制：確保資料庫中永遠存在一間名稱為「班級教室」、型態為「普通」的預設教室
    default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
    if not default_cr:
        default_cr = models.Classroom(name="班級教室", type="普通")
        db.add(default_cr)
        db.commit()
        db.refresh(default_cr)
    
    # 自動修復：確保所有班級的 default_classroom_id 都正確綁定到「班級教室」
    classroom_ids = [r.id for r in db.query(models.Classroom.id).all()]
    classes_to_fix = db.query(models.Class).filter(
        (models.Class.default_classroom_id == None) | 
        (~models.Class.default_classroom_id.in_(classroom_ids))
    ).all()
    if classes_to_fix:
        for c in classes_to_fix:
            c.default_classroom_id = default_cr.id
        db.commit()

    return db.query(models.Classroom).all()

# --- 基礎資料 API: Classes ---
@app.post("/api/classes", response_model=schemas.Class)
def create_class(cls: schemas.ClassCreate, db: Session = Depends(get_db)):
    db_class = models.Class(**cls.model_dump())
    db.add(db_class)
    db.commit()
    db.refresh(db_class)
    return db_class

@app.get("/api/classes", response_model=List[schemas.Class])
def get_classes(db: Session = Depends(get_db)):
    # 確保「班級教室」存在
    default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
    if not default_cr:
        default_cr = models.Classroom(name="班級教室", type="普通")
        db.add(default_cr)
        db.commit()
        db.refresh(default_cr)
        
    # 自動修復：確保所有班級的 default_classroom_id 都正確綁定到「班級教室」
    classroom_ids = [r.id for r in db.query(models.Classroom.id).all()]
    classes_to_fix = db.query(models.Class).filter(
        (models.Class.default_classroom_id == None) | 
        (~models.Class.default_classroom_id.in_(classroom_ids))
    ).all()
    if classes_to_fix:
        for c in classes_to_fix:
            c.default_classroom_id = default_cr.id
        db.commit()

    return db.query(models.Class).all()

@app.put("/api/classes/{class_id}", response_model=schemas.Class)
def update_class(class_id: int, cls: schemas.ClassCreate, db: Session = Depends(get_db)):
    db_class = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="找不到該班級")
    for key, value in cls.model_dump().items():
        setattr(db_class, key, value)
    db.commit()
    db.refresh(db_class)
    return db_class

@app.delete("/api/classes/{class_id}")
def delete_class(class_id: int, db: Session = Depends(get_db)):
    db_class = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="找不到該班級")
    has_course = db.query(models.Course).filter(models.Course.class_id == class_id).first()
    has_schedule = db.query(models.Schedule).filter(models.Schedule.class_id == class_id).first()
    if has_course or has_schedule:
        raise HTTPException(status_code=400, detail="此班級尚有課程或課表，請先刪除相關資料")
    db.delete(db_class)
    db.commit()
    return {"message": "已成功刪除班級"}

# --- 基礎資料 API: Courses ---
@app.post("/api/courses", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    # 如果有單雙週配對的課程，雙向更新其 paired_course_id
    if course.paired_course_id:
        paired = db.query(models.Course).filter(models.Course.id == course.paired_course_id).first()
        if paired:
            paired.paired_course_id = db_course.id
            db.commit()
            
    return db_course

@app.get("/api/courses", response_model=List[schemas.Course])
def get_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()

@app.put("/api/courses/{course_id}", response_model=schemas.Course)
def update_course(course_id: int, course: schemas.CourseCreate, db: Session = Depends(get_db)):
    """更新課程資料（含教師、節數等）"""
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="找不到該課程")
    for key, value in course.model_dump().items():
        setattr(db_course, key, value)
    db.commit()
    db.refresh(db_course)
    return db_course

@app.post("/api/courses/batch-upsert")
def batch_upsert_courses(entries: List[schemas.CourseCreate], db: Session = Depends(get_db)):
    """
    批次新增或更新課程（課程總表用）。
    以 class_id + name 為 key，若已存在則更新 teacher_id，否則新增。
    """
    results = []
    for entry in entries:
        existing = db.query(models.Course).filter(
            models.Course.class_id == entry.class_id,
            models.Course.name == entry.name
        ).first()
        if existing:
            existing.teacher_id = entry.teacher_id
            existing.classroom_name = entry.classroom_name
            existing.required_periods = entry.required_periods
            db.flush()
            results.append({"action": "updated", "course_id": existing.id})
        else:
            new_course = models.Course(**entry.model_dump())
            db.add(new_course)
            db.flush()
            results.append({"action": "created", "course_id": new_course.id})
    db.commit()
    return {"message": f"已處理 {len(results)} 筆課程", "results": results}

@app.delete("/api/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):
    """刪除課程（同時刪除相關排課紀錄）"""
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="找不到該課程")
    # 先刪除相關排課
    db.query(models.Schedule).filter(models.Schedule.course_id == course_id).delete()
    db.delete(db_course)
    db.commit()
    return {"message": "已成功刪除課程"}

# --- 課表排定 API (Schedules) ---

@app.get("/api/schedules", response_model=List[schemas.Schedule])
def get_schedules(
    class_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    classroom_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Schedule)
    if class_id:
        query = query.filter(models.Schedule.class_id == class_id)
    if classroom_id:
        query = query.filter(models.Schedule.classroom_id == classroom_id)
    if teacher_id:
        # 需要 join course 表來透過 teacher_id 過濾
        query = query.join(models.Course).filter(models.Course.teacher_id == teacher_id)
    return query.all()

@app.post("/api/schedules/check", response_model=schemas.ConflictCheckResult)
def api_check_conflict(
    schedule: schemas.ScheduleCreate,
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    僅驗證此排課是否會有衝突，不寫入資料庫。
    若 classroom_id 為空且課程為 普通 類型，自動帶入班級預設教室。
    """
    # 自動補齊預設教室
    if not schedule.classroom_id:
        course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
        target_name = course.classroom_name if course else "班級教室"
        default_cr = db.query(models.Classroom).filter(models.Classroom.name == target_name).first()
        if not default_cr:
            default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
        if not default_cr:
            default_cr = models.Classroom(name="班級教室", type="普通")
            db.add(default_cr)
            db.commit()
            db.refresh(default_cr)
        schedule.classroom_id = default_cr.id

    conflicts = scheduler.check_conflict(
        db=db,
        class_id=schedule.class_id,
        course_id=schedule.course_id,
        classroom_id=schedule.classroom_id,
        weekday=schedule.weekday,
        period=schedule.period,
        week_type=schedule.week_type,
        exclude_schedule_id=exclude_id
    )
    return schemas.ConflictCheckResult(
        has_conflict=len(conflicts) > 0,
        conflict_messages=conflicts
    )

@app.post("/api/schedules", response_model=schemas.Schedule)
def create_schedule(schedule: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    """
    排定新課程 (包含衝突驗證)。
    若未指定 classroom_id，且課程 classroom_type 為 普通，
    則自動帶入班級的 default_classroom_id。
    """
    # 自動補齊預設教室
    if not schedule.classroom_id:
        course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
        target_name = course.classroom_name if course else "班級教室"
        default_cr = db.query(models.Classroom).filter(models.Classroom.name == target_name).first()
        if not default_cr:
            default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
        if not default_cr:
            default_cr = models.Classroom(name="班級教室", type="普通")
            db.add(default_cr)
            db.commit()
            db.refresh(default_cr)
        schedule.classroom_id = default_cr.id

    conflicts = scheduler.check_conflict(
        db=db,
        class_id=schedule.class_id,
        course_id=schedule.course_id,
        classroom_id=schedule.classroom_id,
        weekday=schedule.weekday,
        period=schedule.period,
        week_type=schedule.week_type
    )
    
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "排課存在衝突，無法新增", "conflicts": conflicts}
        )
        
    # 實作「直接取代原本課程」功能：只取代週次衝突的舊排課
    existing_schedules = db.query(models.Schedule).filter(
        models.Schedule.class_id == schedule.class_id,
        models.Schedule.weekday == schedule.weekday,
        models.Schedule.period == schedule.period
    ).all()
    
    for existing in existing_schedules:
        # 若有衝突 (不是 ODD 碰 EVEN)，則取代舊有課程
        if scheduler.check_week_type_conflict(schedule.week_type, existing.week_type):
            db.delete(existing)
    
    db.flush()
        
    db_schedule = models.Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.put("/api/schedules/{schedule_id}", response_model=schemas.Schedule)
def update_schedule(
    schedule_id: int,
    schedule: schemas.ScheduleCreate,
    db: Session = Depends(get_db)
):
    """
    修改課表 (包含衝突驗證)。
    若未指定 classroom_id，且課程為 普通 類型，自動帶入班級預設教室。
    """
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="找不到該課表紀錄")

    # 自動補齊預設教室
    if not schedule.classroom_id:
        course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
        target_name = course.classroom_name if course else "班級教室"
        default_cr = db.query(models.Classroom).filter(models.Classroom.name == target_name).first()
        if not default_cr:
            default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
        if not default_cr:
            default_cr = models.Classroom(name="班級教室", type="普通")
            db.add(default_cr)
            db.commit()
            db.refresh(default_cr)
        schedule.classroom_id = default_cr.id

    conflicts = scheduler.check_conflict(
        db=db,
        class_id=schedule.class_id,
        course_id=schedule.course_id,
        classroom_id=schedule.classroom_id,
        weekday=schedule.weekday,
        period=schedule.period,
        week_type=schedule.week_type,
        exclude_schedule_id=schedule_id
    )
    
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "修改課表存在衝突，無法更新", "conflicts": conflicts}
        )
        
    # 實作「直接取代原本課程」功能：只取代週次衝突的舊排課
    existing_schedules = db.query(models.Schedule).filter(
        models.Schedule.class_id == schedule.class_id,
        models.Schedule.weekday == schedule.weekday,
        models.Schedule.period == schedule.period,
        models.Schedule.id != schedule_id
    ).all()
    
    for existing in existing_schedules:
        if scheduler.check_week_type_conflict(schedule.week_type, existing.week_type):
            db.delete(existing)
    db.flush()
        
    for key, value in schedule.model_dump().items():
        setattr(db_schedule, key, value)
        
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="找不到該課表紀錄")
    db.delete(db_schedule)
    db.commit()
    return {"message": "已成功刪除課表紀錄"}

# --- 系統匯入匯出 API ---
@app.get("/api/system/export", response_model=schemas.SystemData)
def export_system_data(db: Session = Depends(get_db)):
    return schemas.SystemData(
        teachers=db.query(models.Teacher).all(),
        classrooms=db.query(models.Classroom).all(),
        classes=db.query(models.Class).all(),
        courses=db.query(models.Course).all(),
        schedules=db.query(models.Schedule).all()
    )

@app.post("/api/system/import")
def import_system_data(data: schemas.SystemData, db: Session = Depends(get_db)):
    try:
        # 強制重構資料表
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        for t in data.teachers:
            db_teacher = models.Teacher(id=t.id, name=t.name, is_tutor=t.is_tutor)
            db_teacher.unavailable_slots = t.unavailable_slots
            db.add(db_teacher)
            
        for c in data.classrooms:
            db.add(models.Classroom(id=c.id, name=c.name, type=c.type))
            
        for c in data.classes:
            db.add(models.Class(id=c.id, name=c.name, grade=c.grade, tutor_id=c.tutor_id, default_classroom_id=c.default_classroom_id))
            
        for c in data.courses:
            db.add(models.Course(id=c.id, name=c.name, teacher_id=c.teacher_id, class_id=c.class_id, classroom_name=c.classroom_name, week_type=c.week_type, required_periods=c.required_periods, paired_course_id=c.paired_course_id))
            
        for s in data.schedules:
            db.add(models.Schedule(id=s.id, class_id=s.class_id, course_id=s.course_id, classroom_id=s.classroom_id, weekday=s.weekday, period=s.period))
            
        db.commit()
        return {"message": "系統資料匯入成功！"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"匯入失敗: {str(e)}")

# --- 初始化範例資料 API ---
@app.post("/api/init-demo-data")
def init_demo_data(db: Session = Depends(get_db)):
    """
    清除既有資料並建立適用於國小場景的單雙週範例資料
    """
    # 強制重構資料表以套用最新的 Schema 欄位
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # 1. 建立教師
    t_wang = models.Teacher(name="王大明 (一年忠班導師)", is_tutor=True)
    t_chen = models.Teacher(name="陳美惠 (二年孝班導師)", is_tutor=True)
    t_lin = models.Teacher(name="林小華 (三年仁班導師)", is_tutor=True)
    t_chang = models.Teacher(name="張志明 (四年愛班導師)", is_tutor=True)
    t_lee = models.Teacher(name="李科任 (英語專科)", is_tutor=False)
    t_huang = models.Teacher(name="黃體育 (體育專科)", is_tutor=False)
    db.add_all([t_wang, t_chen, t_lin, t_chang, t_lee, t_huang])
    db.commit()

    # 設定李老師週一第一節不可排課
    t_lee.unavailable_slots = ["1-1"]
    db.commit()

    # 2. 建立教室 (整併各班教室為單一「班級教室」)
    cr_class = models.Classroom(name="班級教室", type="普通")
    cr_science = models.Classroom(name="自然教室", type="自然")
    cr_music = models.Classroom(name="音樂教室", type="音樂")
    cr_art = models.Classroom(name="美勞教室", type="美勞")
    cr_pe = models.Classroom(name="操場", type="體育")
    cr_library = models.Classroom(name="圖書館", type="圖書館")
    db.add_all([cr_class, cr_science, cr_music, cr_art, cr_pe, cr_library])
    db.commit()

    # 3. 建立班級並綁定預設普通教室
    c_1 = models.Class(name="一年忠班", grade=1, tutor_id=t_wang.id, default_classroom_id=cr_class.id)
    c_2 = models.Class(name="二年孝班", grade=2, tutor_id=t_chen.id, default_classroom_id=cr_class.id)
    c_3 = models.Class(name="三年仁班", grade=3, tutor_id=t_lin.id, default_classroom_id=cr_class.id)
    c_4 = models.Class(name="四年愛班", grade=4, tutor_id=t_chang.id, default_classroom_id=cr_class.id)
    c_5 = models.Class(name="五年信班", grade=5, tutor_id=None, default_classroom_id=cr_class.id)
    c_6 = models.Class(name="六年義班", grade=6, tutor_id=None, default_classroom_id=cr_class.id)
    db.add_all([c_1, c_2, c_3, c_4, c_5, c_6])
    db.commit()

    # 4. 建立課程 (含每週應排節數)
    demo_courses = [
        # 一年忠班課程
        models.Course(name="國語", teacher_id=t_wang.id, class_id=c_1.id, classroom_name="班級教室", week_type="EVERY", required_periods=5),
        models.Course(name="數學", teacher_id=t_wang.id, class_id=c_1.id, classroom_name="班級教室", week_type="EVERY", required_periods=4),
        models.Course(name="自然", teacher_id=t_lee.id, class_id=c_1.id, classroom_name="自然教室", week_type="EVERY", required_periods=2),
        models.Course(name="體育", teacher_id=t_huang.id, class_id=c_1.id, classroom_name="操場", week_type="EVERY", required_periods=2),

        # 二年孝班課程
        models.Course(name="國語", teacher_id=t_chen.id, class_id=c_2.id, classroom_name="班級教室", week_type="EVERY", required_periods=5),
        models.Course(name="數學", teacher_id=t_chen.id, class_id=c_2.id, classroom_name="班級教室", week_type="EVERY", required_periods=4),
        models.Course(name="音樂", teacher_id=t_lee.id, class_id=c_2.id, classroom_name="音樂教室", week_type="EVERY", required_periods=2),
        models.Course(name="體育", teacher_id=t_huang.id, class_id=c_2.id, classroom_name="操場", week_type="EVERY", required_periods=2),

        # 三年仁班課程
        models.Course(name="國語", teacher_id=t_lin.id, class_id=c_3.id, classroom_name="班級教室", week_type="EVERY", required_periods=5),
        models.Course(name="數學", teacher_id=t_lin.id, class_id=c_3.id, classroom_name="班級教室", week_type="EVERY", required_periods=4),
        models.Course(name="美勞", teacher_id=t_lee.id, class_id=c_3.id, classroom_name="美勞教室", week_type="EVERY", required_periods=2),
        models.Course(name="體育", teacher_id=t_huang.id, class_id=c_3.id, classroom_name="操場", week_type="EVERY", required_periods=2),
        models.Course(name="圖書館", teacher_id=t_lin.id, class_id=c_3.id, classroom_name="圖書館", week_type="EVERY", required_periods=1),

        # 四年愛班課程
        models.Course(name="國語", teacher_id=t_chang.id, class_id=c_4.id, classroom_name="班級教室", week_type="EVERY", required_periods=5),
        models.Course(name="數學", teacher_id=t_chang.id, class_id=c_4.id, classroom_name="班級教室", week_type="EVERY", required_periods=4),
        models.Course(name="自然", teacher_id=t_lee.id, class_id=c_4.id, classroom_name="自然教室", week_type="EVERY", required_periods=2),
        models.Course(name="體育", teacher_id=t_huang.id, class_id=c_4.id, classroom_name="操場", week_type="EVERY", required_periods=2)
    ]

    db.add_all(demo_courses)
    db.commit()

    return {"message": "範例資料初始化成功！"}

# --- 教師不可排課時段更新 API ---
@app.put("/api/teachers/{teacher_id}/unavailable-slots", response_model=schemas.Teacher)
def update_teacher_unavailable_slots(
    teacher_id: int,
    unavailable_slots: List[str],
    db: Session = Depends(get_db)
):
    db_teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
    if not db_teacher:
        raise HTTPException(status_code=404, detail="找不到該教師")
    db_teacher.unavailable_slots = unavailable_slots
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

# --- 教師名稱解析 API (供 CSV 匯入前端使用) ---
@app.post("/api/teachers/resolve-names")
def resolve_teacher_names(names: List[str], db: Session = Depends(get_db)):
    """
    接收教師姓名陣列，回傳可比對到的 {name: id} 對照表
    以及無法比對的名稱列表，供前端 CSV 匯入驗證
    """
    all_teachers = db.query(models.Teacher).all()
    # 建立名稱 → id 的正向對照（支援部分比對：只要姓名包含輸入字串即視為符合）
    result = {}
    unmatched = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        matched = next(
            (t for t in all_teachers if name in t.name or t.name.startswith(name)),
            None
        )
        if matched:
            result[name] = matched.id
        else:
            unmatched.append(name)
    return {"matched": result, "unmatched": unmatched}

# --- 批次匯入教師不可排課時段 API ---
@app.post("/api/teachers/import-unavailable-slots", response_model=schemas.TeacherUnavailableSlotsImportResult)
def import_teacher_unavailable_slots(
    data: schemas.TeacherUnavailableSlotsImport,
    db: Session = Depends(get_db)
):
    """
    批次更新多位教師的不可排課時段（先清空再覆蓋）
    """
    success_count = 0
    failed = []

    for entry in data.entries:
        db_teacher = db.query(models.Teacher).filter(models.Teacher.id == entry.teacher_id).first()
        if not db_teacher:
            failed.append(f"ID={entry.teacher_id}")
            continue
        db_teacher.unavailable_slots = entry.unavailable_slots
        success_count += 1

    db.commit()
    return schemas.TeacherUnavailableSlotsImportResult(
        success_count=success_count,
        failed=failed
    )


# --- 課程更新與刪除 API ---
@app.put("/api/courses/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: int,
    course: schemas.CourseCreate,
    db: Session = Depends(get_db)
):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="找不到該課程")
    
    for key, value in course.model_dump().items():
        setattr(db_course, key, value)
        
    db.commit()
    db.refresh(db_course)
    
    # 如果更新了配對課程，也進行相應的處理 (暫無變動)
    return db_course

@app.delete("/api/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="找不到該課程")
    
    # 檢查是否有排課表關聯此課程
    has_schedule = db.query(models.Schedule).filter(models.Schedule.course_id == course_id).first()
    if has_schedule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此課程已被排入課表中，請先將其從課表中移除再刪除課程"
        )
        
    db.delete(db_course)
    db.commit()
    return {"message": "已成功刪除課程"}

# --- 設定檔 API ---
@app.get("/api/config", response_model=schemas.SystemConfig)
def get_system_config():
    return load_config()

@app.put("/api/config", response_model=schemas.SystemConfig)
def update_system_config(config: schemas.SystemConfig, db: Session = Depends(get_db)):
    save_config(config)
    
    # 同步更新班級至 DB
    for c in config.classes:
        c_code = str(c.code) if c.code is not None else None
        existing = db.query(models.Class).filter(models.Class.name == c.name).first()
        if not existing:
            new_class = models.Class(code=c_code, name=c.name, grade=c.grade)
            db.add(new_class)
        else:
            existing.code = c_code
            existing.grade = c.grade
    db.commit()
    
    return config

# --- 匯入合併與新增 CSV API ---
@app.post("/api/teachers/import-with-slots", response_model=schemas.GenericImportResult)
def import_teachers_with_slots(
    data: schemas.TeacherWithSlotsImport,
    db: Session = Depends(get_db)
):
    # 先清除原本資料
    try:
        # 清空依賴教師的排課與課程，避免外鍵衝突或前端找不到對應教師
        db.query(models.Schedule).delete()
        db.query(models.Course).delete()
        # 解除班級導師綁定
        for c in db.query(models.Class).all():
            c.tutor_id = None
        # 刪除所有教師
        db.query(models.Teacher).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清除舊資料失敗: {str(e)}")

    success_count = 0
    failed_entries = []

    for entry in data.entries:
        if not entry.teacher_name.strip():
            continue
        
        # 尋找教師或建立新教師
        db_teacher = db.query(models.Teacher).filter(models.Teacher.name == entry.teacher_name.strip()).first()
        if not db_teacher:
            db_teacher = models.Teacher(name=entry.teacher_name.strip(), is_tutor=False)
            db.add(db_teacher)
            db.flush() # 取得 ID
            
        db_teacher.unavailable_slots = entry.unavailable_slots
        success_count += 1

    db.commit()
    return schemas.GenericImportResult(success_count=success_count, failed_entries=failed_entries)

@app.post("/api/courses/import-csv", response_model=schemas.GenericImportResult)
def import_courses_csv(
    data: schemas.CourseImport,
    db: Session = Depends(get_db)
):
    # 先清除原本資料 (課表與科目)
    try:
        db.query(models.Schedule).delete()
        db.query(models.Course).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清除舊資料失敗: {str(e)}")

    success_count = 0
    failed_entries = []

    for entry in data.entries:
        try:
            # 尋找班級 (依據代號或名稱)
            class_query_val = entry.class_name.strip()
            db_class = db.query(models.Class).filter(
                (models.Class.code == class_query_val) | (models.Class.name == class_query_val)
            ).first()
            if not db_class:
                failed_entries.append(f"找不到班級: {class_query_val}")
                continue
                
            # 尋找教師
            db_teacher = db.query(models.Teacher).filter(models.Teacher.name == entry.teacher_name.strip()).first()
            if not db_teacher:
                failed_entries.append(f"找不到教師: {entry.teacher_name}")
                continue
                
            # 教室名稱對應
            classroom_name = "班級教室"
            if entry.classroom_name:
                classroom_name = entry.classroom_name.strip()
            
            week_type_val = entry.week_type.strip().upper() if entry.week_type else "EVERY"
            if week_type_val not in ["EVERY", "ODD", "EVEN"]:
                week_type_val = "EVERY"

            new_course = models.Course(
                name=entry.subject.strip(),
                teacher_id=db_teacher.id,
                class_id=db_class.id,
                classroom_name=classroom_name,
                required_periods=entry.periods,
                week_type="EVERY"  # 統一為 EVERY，自選排課時再決定單雙週
            )
            db.add(new_course)
            success_count += 1
        except Exception as e:
            failed_entries.append(f"錯誤 {entry.class_name} {entry.subject}: {str(e)}")

    db.commit()
    return schemas.GenericImportResult(success_count=success_count, failed_entries=failed_entries)

@app.post("/api/classrooms/import-csv", response_model=schemas.GenericImportResult)
def import_classrooms_csv(
    data: schemas.ClassroomImport,
    db: Session = Depends(get_db)
):
    success_count = 0
    failed_entries = []

    for entry in data.entries:
        if not entry.name.strip():
            continue
            
        db_room = db.query(models.Classroom).filter(models.Classroom.name == entry.name.strip()).first()
        if not db_room:
            new_room = models.Classroom(
                name=entry.name.strip(),
                type=entry.type.strip() or "普通"
            )
            db.add(new_room)
        else:
            db_room.type = entry.type.strip() or "普通"
        success_count += 1

    db.commit()

    # 防呆機制：確保資料庫中永遠存在一間名稱為「班級教室」、型態為「普通」的預設教室，並自動修正所有班級的預設教室
    default_cr = db.query(models.Classroom).filter(models.Classroom.name == "班級教室").first()
    if not default_cr:
        default_cr = models.Classroom(name="班級教室", type="普通")
        db.add(default_cr)
        db.commit()
        db.refresh(default_cr)
        
    classroom_ids = [r.id for r in db.query(models.Classroom.id).all()]
    classes_to_fix = db.query(models.Class).filter(
        (models.Class.default_classroom_id == None) | 
        (~models.Class.default_classroom_id.in_(classroom_ids))
    ).all()
    if classes_to_fix:
        for c in classes_to_fix:
            c.default_classroom_id = default_cr.id
        db.commit()

    return schemas.GenericImportResult(success_count=success_count, failed_entries=failed_entries)


# --- 首頁轉導與靜態檔案服務 ---

@app.get("/")
def read_root():
    return RedirectResponse(url="/static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
