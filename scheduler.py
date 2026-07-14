from sqlalchemy.orm import Session
from typing import List, Optional
import models

def check_week_type_conflict(week1: str, week2: str) -> bool:
    """
    單雙週衝突判斷。
    若一個是單週 (ODD) 另一個是雙週 (EVEN)，則無衝突 (回傳 False)。
    其他情況 (包含碰到 EVERY, 或是同為 ODD/EVEN) 皆判定為衝突 (回傳 True)。
    """
    if (week1 == "ODD" and week2 == "EVEN") or (week1 == "EVEN" and week2 == "ODD"):
        return False
    return True

def check_conflict(
    db: Session,
    class_id: int,
    course_id: int,
    classroom_id: Optional[int],
    weekday: int,
    period: int,
    week_type: str = "EVERY",
    exclude_schedule_id: Optional[int] = None
) -> List[str]:
    """
    衝突偵測引擎：驗證排課資料是否違反硬性限制。
    回傳衝突原因的字串列表，若為空代表無衝突。
    classroom_id 為 Optional，若未指定則跳過教室相關衝突偵測。
    """
    conflicts = []

    # 1. 取得排課主體資料
    target_class = db.query(models.Class).filter(models.Class.id == class_id).first()
    target_course = db.query(models.Course).filter(models.Course.id == course_id).first()

    if not target_class or not target_course:
        return ["無效的班級或課程資料"]

    # 若有指定教室，查詢教室資料
    target_classroom = None
    if classroom_id:
        target_classroom = db.query(models.Classroom).filter(models.Classroom.id == classroom_id).first()
        if not target_classroom:
            return [f"找不到 ID={classroom_id} 的教室資料"]

    teacher_id = target_course.teacher_id
    target_teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()

    # 2. 教師不可排課時間偵測 (無效時段)
    if target_teacher:
        slot_key = f"{weekday}-{period}"
        if slot_key in target_teacher.unavailable_slots:
            conflicts.append(f"{target_teacher.name} 老師在此時段（週{weekday}第{period}節）設定為不排課時間")

    # 3. 教室匹配偵測：排課時授課教室不需要跟科目設定一樣，故此處不限制

    # 4. 檢索該時段（weekday, period）所有既存的排課紀錄
    query = db.query(models.Schedule).filter(
        models.Schedule.weekday == weekday,
        models.Schedule.period == period
    )
    if exclude_schedule_id:
        query = query.filter(models.Schedule.id != exclude_schedule_id)
    
    existing_schedules = query.all()

    for s in existing_schedules:
        # 實作「取代原本課程」功能：
        # 如果是同班級在該時段的既有課表，我們預期會直接將其覆蓋，
        # 因此不應將它視為衝突來源（包含不觸發同教師、同教室等衝突）。
        if s.class_id == class_id:
            continue

        # 取得該時段已排定的課程與教師
        existing_course = db.query(models.Course).filter(models.Course.id == s.course_id).first()
        if not existing_course:
            continue
        
        # 判斷週屬性是否會重疊 (單雙週衝突判斷，改從已排 Schedule 中的 week_type 獲取)
        is_week_overlap = check_week_type_conflict(week_type, s.week_type)
        if not is_week_overlap:
            # 單雙週錯開，不發生衝突
            continue

        # A. 教師衝突檢測
        if existing_course.teacher_id == teacher_id:
            existing_teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
            teacher_name = existing_teacher.name if existing_teacher else "未知教師"
            existing_class = db.query(models.Class).filter(models.Class.id == s.class_id).first()
            class_name = existing_class.name if existing_class else "其他班級"
            conflicts.append(
                f"{teacher_name} 老師此時段已在「{class_name}」授課 ({s.week_type}週)"
            )

        # B. 教室衝突檢測（排除非共享的「班級教室」/普通教室）
        if target_classroom and classroom_id and s.classroom_id == classroom_id and target_classroom.name != "班級教室" and target_classroom.type != "普通":
            existing_class = db.query(models.Class).filter(models.Class.id == s.class_id).first()
            class_name = existing_class.name if existing_class else "其他班級"
            conflicts.append(
                f"教室「{target_classroom.name}」此時段已被「{class_name}」佔用 ({s.week_type}週)"
            )

    return conflicts
