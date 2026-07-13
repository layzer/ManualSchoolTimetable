import json
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_tutor = Column(Boolean, default=False)
    # 不可排課的時間段，儲存格式為 JSON Array，例如 '["1-1", "3-5"]' 代表週一第一節、週三第五節不可排課
    unavailable_slots_raw = Column(Text, default="[]")

    @property
    def unavailable_slots(self):
        try:
            return json.loads(self.unavailable_slots_raw)
        except Exception:
            return []

    @unavailable_slots.setter
    def unavailable_slots(self, value):
        self.unavailable_slots_raw = json.dumps(value)

    # Relationships
    courses = relationship("Course", back_populates="teacher")
    tutor_class = relationship("Class", back_populates="tutor", uselist=False)


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    type = Column(String, default="普通")  # 普通, 自然, 音樂, 美勞, 體育, 圖書館 等

    # Relationships
    schedules = relationship("Schedule", back_populates="classroom")


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=True, unique=True)  # 班級代號
    name = Column(String, nullable=False, unique=True)  # 例如 "一年甲班"
    grade = Column(Integer, nullable=False)  # 1~6 年級，用以實施半天/整天限制
    tutor_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    default_classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)

    # Relationships
    tutor = relationship("Teacher", back_populates="tutor_class")
    default_classroom = relationship("Classroom", foreign_keys=[default_classroom_id])
    schedules = relationship("Schedule", back_populates="class_")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # 例如 "國語", "英文", "資訊"
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)  # 新增班級外鍵
    classroom_name = Column(String, default="班級教室")  # 預設上課需要的教室名稱
    week_type = Column(String, default="EVERY")  # EVERY, ODD (單週), EVEN (雙週)
    required_periods = Column(Float, default=1.0)  # 每週應排課節數（規劃節數）
    paired_course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)  # 單雙週配對課程的 ID

    # Relationships
    teacher = relationship("Teacher", back_populates="courses")
    class_ = relationship("Class", foreign_keys=[class_id])  # 新增班級關聯
    schedules = relationship("Schedule", back_populates="course")
    
    # 自關聯：單雙週配對課程
    paired_course = relationship("Course", remote_side=[id], post_update=True)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    weekday = Column(Integer, nullable=False)  # 1 (週一) ~ 5 (週五)
    period = Column(Integer, nullable=False)   # 1 ~ 8 (第 1 節 ~ 第 8 節)
    week_type = Column(String, default="EVERY")  # EVERY, ODD, EVEN

    # Relationships
    class_ = relationship("Class", back_populates="schedules")
    course = relationship("Course", back_populates="schedules")
    classroom = relationship("Classroom", back_populates="schedules")
