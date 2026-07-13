from pydantic import BaseModel, Field
from typing import List, Optional, Union

# --- Teacher ---
class TeacherBase(BaseModel):
    name: str
    is_tutor: bool = False
    unavailable_slots: List[str] = []

class TeacherCreate(TeacherBase):
    pass

class Teacher(TeacherBase):
    id: int

    class Config:
        from_attributes = True


# --- Classroom ---
class ClassroomBase(BaseModel):
    name: str
    type: str = "普通"

class ClassroomCreate(ClassroomBase):
    pass

class Classroom(ClassroomBase):
    id: int

    class Config:
        from_attributes = True


# --- Class ---
class ClassBase(BaseModel):
    code: Optional[Union[str, int]] = None
    name: str
    grade: int = Field(..., ge=1, le=6, description="國小年級 1~6")
    tutor_id: Optional[int] = None
    default_classroom_id: Optional[int] = None

class ClassCreate(ClassBase):
    pass

class Class(ClassBase):
    id: int

    class Config:
        from_attributes = True


# --- Course ---
class CourseBase(BaseModel):
    name: str
    teacher_id: int
    class_id: Optional[int] = None
    classroom_name: str = "班級教室"
    week_type: str = "EVERY"  # EVERY, ODD, EVEN
    required_periods: int = 1  # 每週應排課節數（規劃節數）
    paired_course_id: Optional[int] = None

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int

    class Config:
        from_attributes = True


# --- Schedule ---
class ScheduleBase(BaseModel):
    class_id: int
    course_id: int
    classroom_id: Optional[int] = None
    weekday: int = Field(..., ge=1, le=5)
    period: int = Field(..., ge=1, le=8)
    week_type: str = "EVERY"  # EVERY, ODD, EVEN

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int

    class Config:
        from_attributes = True


# --- 衝突偵測 Response ---
class ConflictCheckResult(BaseModel):
    has_conflict: bool
    conflict_messages: List[str] = []

# --- 系統匯入匯出 ---
class SystemData(BaseModel):
    teachers: List[Teacher] = []
    classrooms: List[Classroom] = []
    classes: List[Class] = []
    courses: List[Course] = []
    schedules: List[Schedule] = []


# --- 批次匯入教師不可排課時段 ---
class TeacherUnavailableSlotEntry(BaseModel):
    teacher_id: int
    unavailable_slots: List[str]  # 格式如 ["1-1", "2-3"]

class TeacherUnavailableSlotsImport(BaseModel):
    entries: List[TeacherUnavailableSlotEntry]

class TeacherUnavailableSlotsImportResult(BaseModel):
    success_count: int
    failed: List[str] = []  # 無法比對的教師姓名列表


# --- 系統設定檔 (config.json) ---
class PeriodConfig(BaseModel):
    id: str
    name: str
    type: str
    is_schedulable: bool

class ClassConfig(BaseModel):
    code: Optional[Union[str, int]] = None
    name: str
    grade: int

class SystemConfig(BaseModel):
    periods: List[PeriodConfig] = []
    classes: List[ClassConfig] = []


# --- CSV 匯入專用 Request / Response ---

class TeacherWithSlotsImportEntry(BaseModel):
    teacher_name: str
    unavailable_slots: List[str]  # e.g., ["1-1", "1-2"]

class TeacherWithSlotsImport(BaseModel):
    entries: List[TeacherWithSlotsImportEntry]

class CourseImportEntry(BaseModel):
    class_name: str
    subject: str
    periods: int
    teacher_name: str
    classroom_name: Optional[str] = None
    week_type: Optional[str] = "EVERY"

class CourseImport(BaseModel):
    entries: List[CourseImportEntry]

class ClassroomImportEntry(BaseModel):
    name: str
    type: str = "普通"

class ClassroomImport(BaseModel):
    entries: List[ClassroomImportEntry]

class GenericImportResult(BaseModel):
    success_count: int
    failed_entries: List[str] = []

