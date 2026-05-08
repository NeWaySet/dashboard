from datetime import date

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.mock_data import DEMO_ROOMS, demo_lessons
from app.models import LessonModel, RoomModel
from app.schemas import Lesson, Room


settings = get_settings()


def _room_from_model(room: RoomModel) -> Room:
    return Room.model_validate(room)


def _lesson_from_model(lesson: LessonModel) -> Lesson:
    return Lesson(
        id=lesson.id,
        date=lesson.date,
        starts_at=lesson.starts_at,
        ends_at=lesson.ends_at,
        subject=lesson.subject,
        teacher=lesson.teacher,
        group=lesson.group_name,
        room_id=lesson.room_id,
        room_title=lesson.room.title,
        building=lesson.room.building,
        floor=lesson.room.floor,
    )


def _matches(value: str, query: str) -> bool:
    return query.casefold() in value.casefold()


async def list_rooms(session: AsyncSession | None) -> list[Room]:
    if settings.should_use_demo_data or session is None:
        return DEMO_ROOMS

    result = await session.execute(select(RoomModel).order_by(RoomModel.floor, RoomModel.title))
    return [_room_from_model(room) for room in result.scalars().all()]


async def lessons_for_date(session: AsyncSession | None, target_date: date) -> list[Lesson]:
    if settings.should_use_demo_data or session is None:
        return [lesson for lesson in demo_lessons() if lesson.date == target_date]

    statement = _base_lesson_query().where(LessonModel.date == target_date)
    result = await session.execute(statement)
    return [_lesson_from_model(lesson) for lesson in result.scalars().all()]


async def room_lessons_for_date(
    session: AsyncSession | None,
    room_id: int,
    target_date: date,
) -> list[Lesson]:
    lessons = await lessons_for_date(session, target_date)
    return [lesson for lesson in lessons if lesson.room_id == room_id]


async def teacher_lessons_for_date(
    session: AsyncSession | None,
    query: str,
    target_date: date,
) -> list[Lesson]:
    if settings.should_use_demo_data or session is None:
        return [
            lesson
            for lesson in demo_lessons()
            if lesson.date == target_date and _matches(lesson.teacher, query)
        ]

    statement = (
        _base_lesson_query()
        .where(LessonModel.date == target_date)
        .where(LessonModel.teacher.ilike(f"%{query}%"))
    )
    result = await session.execute(statement)
    return [_lesson_from_model(lesson) for lesson in result.scalars().all()]


async def group_lessons_for_date(
    session: AsyncSession | None,
    query: str,
    target_date: date,
) -> list[Lesson]:
    if settings.should_use_demo_data or session is None:
        return [
            lesson
            for lesson in demo_lessons()
            if lesson.date == target_date and _matches(lesson.group, query)
        ]

    statement = (
        _base_lesson_query()
        .where(LessonModel.date == target_date)
        .where(LessonModel.group_name.ilike(f"%{query}%"))
    )
    result = await session.execute(statement)
    return [_lesson_from_model(lesson) for lesson in result.scalars().all()]


def _base_lesson_query() -> Select[tuple[LessonModel]]:
    return (
        select(LessonModel)
        .options(selectinload(LessonModel.room))
        .order_by(LessonModel.starts_at, LessonModel.room_id)
    )
