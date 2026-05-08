from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.mock_data import moscow_today
from app.repository import lessons_for_date
from app.schemas import Lesson


router = APIRouter(tags=["schedule"])


@router.get("/schedule/today", response_model=list[Lesson])
async def get_today_schedule(
    session: AsyncSession | None = Depends(get_session),
) -> list[Lesson]:
    return await lessons_for_date(session, moscow_today())
