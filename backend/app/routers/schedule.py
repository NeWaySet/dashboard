from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.mock_data import moscow_today
from app.repository import lessons_for_date
from app.routers.errors import database_required_error
from app.schemas import Lesson


router = APIRouter(tags=["schedule"])


@router.get("/schedule/today", response_model=list[Lesson])
async def get_today_schedule(
    session: AsyncSession | None = Depends(get_session),
) -> list[Lesson]:
    try:
        return await lessons_for_date(session, moscow_today())
    except RuntimeError as exc:
        raise database_required_error(exc) from exc


@router.get("/schedule", response_model=list[Lesson])
async def get_schedule_by_date(
    target_date: date = Query(alias="date"),
    session: AsyncSession | None = Depends(get_session),
) -> list[Lesson]:
    try:
        return await lessons_for_date(session, target_date)
    except RuntimeError as exc:
        raise database_required_error(exc) from exc
