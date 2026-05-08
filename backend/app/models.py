from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class RoomModel(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(32), index=True)
    building: Mapped[str] = mapped_column(String(128), default="Главный корпус")
    floor: Mapped[int] = mapped_column(Integer)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    room_type: Mapped[str] = mapped_column(String(64), default="Аудитория")
    map_x: Mapped[int] = mapped_column(Integer, default=0)
    map_y: Mapped[int] = mapped_column(Integer, default=0)
    map_width: Mapped[int] = mapped_column(Integer, default=12)
    map_height: Mapped[int] = mapped_column(Integer, default=12)
    zone: Mapped[str] = mapped_column(String(64), default="main")

    lessons: Mapped[list["LessonModel"]] = relationship(back_populates="room")


class LessonModel(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    starts_at: Mapped[time] = mapped_column(Time)
    ends_at: Mapped[time] = mapped_column(Time)
    subject: Mapped[str] = mapped_column(String(160))
    teacher: Mapped[str] = mapped_column(String(160), index=True)
    group_name: Mapped[str] = mapped_column(String(64), index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))

    room: Mapped[RoomModel] = relationship(back_populates="lessons")
