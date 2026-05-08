from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.mock_data import moscow_today
from app.repository import list_rooms, room_lessons_for_date
from app.schemas import Lesson, Room


router = APIRouter(tags=["rooms"])


@router.get("/rooms", response_model=list[Room])
async def get_rooms(session: AsyncSession | None = Depends(get_session)) -> list[Room]:
    return await list_rooms(session)


@router.get("/rooms/{room_id}/lessons/today", response_model=list[Lesson])
async def get_room_today_lessons(
    room_id: int,
    session: AsyncSession | None = Depends(get_session),
) -> list[Lesson]:
    return await room_lessons_for_date(session, room_id, moscow_today())
