from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.mock_data import moscow_today
from app.repository import group_lessons_for_date, teacher_lessons_for_date
from app.schemas import SearchResult


router = APIRouter(tags=["search"])


@router.get("/search/teacher", response_model=SearchResult)
async def search_teacher(
    query: str = Query(min_length=2),
    session: AsyncSession | None = Depends(get_session),
) -> SearchResult:
    lessons = await teacher_lessons_for_date(session, query, moscow_today())
    return SearchResult(
        query=query,
        kind="teacher",
        lessons=lessons,
        highlighted_room_ids=sorted({lesson.room_id for lesson in lessons}),
        highlighted_room_titles=sorted({lesson.room_title for lesson in lessons}),
    )


@router.get("/search/group", response_model=SearchResult)
async def search_group(
    query: str = Query(min_length=2),
    session: AsyncSession | None = Depends(get_session),
) -> SearchResult:
    lessons = await group_lessons_for_date(session, query, moscow_today())
    return SearchResult(
        query=query,
        kind="group",
        lessons=lessons,
        highlighted_room_ids=sorted({lesson.room_id for lesson in lessons}),
        highlighted_room_titles=sorted({lesson.room_title for lesson in lessons}),
    )
