import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import models
from scheduler import check_conflict

# 初始化測試用記憶體資料庫
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(name="db")
def session_fixture():
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # 建立 Tables
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def setup_test_data(db):
    """
    建立基本測試資料。
    """
    # 1. 建立教師
    t_wang = models.Teacher(name="王導師 (一年級)", is_tutor=True)
    t_chen = models.Teacher(name="陳科任 (英語)", is_tutor=False)
    # 陳老師設定週一第一節(1-1)不可排課
    t_chen.unavailable_slots = ["1-1"]
    
    db.add_all([t_wang, t_chen])
    db.commit()

    # 2. 建立教室
    cr_normal = models.Classroom(name="1A 教室", type="普通")
    cr_english = models.Classroom(name="自然教室", type="自然")
    
    db.add_all([cr_normal, cr_english])
    db.commit()

    # 3. 建立班級
    c_1a = models.Class(name="一年甲班", grade=1, tutor_id=t_wang.id)
    c_5a = models.Class(name="五年甲班", grade=5, tutor_id=None)
    
    db.add_all([c_1a, c_5a])
    db.commit()

    # 4. 建立課程
    c_mandarin = models.Course(name="國語 (導師/每週)", teacher_id=t_wang.id, classroom_name="1A 教室", week_type="EVERY")
    c_english = models.Course(name="自然 (科任/每週)", teacher_id=t_chen.id, classroom_name="自然教室", week_type="EVERY")
    
    # 單雙週配對課程
    c_info = models.Course(name="資訊 (單)", teacher_id=t_chen.id, classroom_name="1A 教室", week_type="ODD")
    c_reading = models.Course(name="閱讀 (雙)", teacher_id=t_chen.id, classroom_name="1A 教室", week_type="EVEN")
    
    db.add_all([c_mandarin, c_english, c_info, c_reading])
    db.commit()
    
    c_info.paired_course_id = c_reading.id
    c_reading.paired_course_id = c_info.id
    db.commit()

    return {
        "teachers": {"wang": t_wang.id, "chen": t_chen.id},
        "classrooms": {"normal": cr_normal.id, "english": cr_english.id},
        "classes": {"1a": c_1a.id, "5a": c_5a.id},
        "courses": {
            "mandarin": c_mandarin.id,
            "english": c_english.id,
            "info": c_info.id,
            "reading": c_reading.id
        }
    }

def test_no_conflict_schedule(db):
    """
    測試正常的排課狀況，應該無衝突
    """
    ids = setup_test_data(db)
    
    # 排定國語課在一甲週一第二節
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["mandarin"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=1,
        period=2
    )
    assert len(conflicts) == 0

def test_teacher_conflict(db):
    """
    測試同一個教師在相同時間被排在兩個不同的地方
    """
    ids = setup_test_data(db)
    
    # 先將王老師排在一甲週二第一節
    s1 = models.Schedule(
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["mandarin"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=1
    )
    db.add(s1)
    db.commit()
    
    # 嘗試將王老師排在五甲週二第一節 (此時王老師會分身乏術)
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["5a"],
        course_id=ids["courses"]["mandarin"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=1
    )
    assert len(conflicts) > 0
    assert any("老師此時段已在" in msg for msg in conflicts)

def test_odd_even_week_conflict(db):
    """
    測試取消單雙週後，不同週類型的課程在同一時段排課應發生衝突（經由教師衝突）。
    """
    ids = setup_test_data(db)
    
    # 1. 先排「單週」資訊課在一甲週二第三節 (教師為陳老師)
    s_info = models.Schedule(
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["info"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=3,
        week_type="ODD"
    )
    db.add(s_info)
    db.commit()
    
    # 2. 嘗試排「雙週」閱讀課在五甲週二第三節 (同一位陳老師)，此時因單雙週錯開，不應發生衝突
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["5a"],
        course_id=ids["courses"]["reading"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=3,
        week_type="EVEN"
    )
    assert len(conflicts) == 0

def test_every_week_with_odd_week_conflict(db):
    """
    測試「每週」課程與「單週」課程在同一時段，若共用教師應發生衝突
    """
    ids = setup_test_data(db)
    
    # 1. 先排「單週」資訊課在一甲週二第三節 (教師為陳老師)
    s_info = models.Schedule(
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["info"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=3,
        week_type="ODD"
    )
    db.add(s_info)
    db.commit()
    
    # 2. 嘗試排「每週」科任課在五甲週二第三節 (教師同樣為陳老師)，應發生衝突
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["5a"],
        course_id=ids["courses"]["english"],
        classroom_id=ids["classrooms"]["english"],
        weekday=2,
        period=3,
        week_type="EVERY"
    )
    assert len(conflicts) > 0
    assert any("老師此時段已在" in msg for msg in conflicts)

def test_no_elementary_early_dismissal(db):
    """
    驗證放學限制拔除後，任何班級週一下午均可排課，無放學衝突。
    """
    ids = setup_test_data(db)
    
    # 一年級週一下午第六節，應無衝突
    conflicts_6 = check_conflict(
        db=db,
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["mandarin"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=1,
        period=6
    )
    assert len(conflicts_6) == 0

def test_teacher_unavailability(db):
    """
    測試教師不可排課時間
    """
    ids = setup_test_data(db)
    
    # 陳老師週一第一節 (1-1) 設定為不可排課
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["english"],
        classroom_id=ids["classrooms"]["english"],
        weekday=1,
        period=1
    )
    assert len(conflicts) > 0
    assert any("設定為不排課時間" in msg for msg in conflicts)

def test_classroom_type_mismatch(db):
    """
    測試教室類型不符
    """
    ids = setup_test_data(db)
    
    # 自然課指定需要 自然教室，若排在 1A 教室 應產生衝突
    conflicts = check_conflict(
        db=db,
        class_id=ids["classes"]["1a"],
        course_id=ids["courses"]["english"],
        classroom_id=ids["classrooms"]["normal"],
        weekday=2,
        period=2
    )
    assert len(conflicts) > 0
    assert any("需要「自然教室」，但所選教室為「1A 教室」" in msg for msg in conflicts)
