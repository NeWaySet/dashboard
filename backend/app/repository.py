from datetime import date
import re
import zlib

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.mock_data import DEMO_ROOMS, demo_lessons
from app.schemas import Lesson, Room


settings = get_settings()

BUILDING_V78 = "\u0412-78"
BUILDING_S20 = "\u0421-20"
BUILDING_MP1 = "\u041c\u041f-1"
ROOM_CAMPUS_PATTERN = re.compile(
    rf"\(?\s*({BUILDING_MP1}|MP-1|{BUILDING_S20}|C-20|{BUILDING_V78}|V-78)\s*\)?",
    re.IGNORECASE,
)
NULL_TEXT_VALUES = {"", "\\N", "None", "none", "NULL", "null"}
REMOTE_ROOM_TITLES = {"дист", "дистанционно", "онлайн"}
PAIR_START_TIMES = {
    1: "09:00",
    2: "10:40",
    3: "12:40",
    4: "14:20",
    5: "16:20",
    6: "18:00",
    7: "19:40",
}
PAIR_END_TIMES = {
    1: "10:30",
    2: "12:10",
    3: "14:10",
    4: "15:50",
    5: "17:50",
    6: "19:30",
    7: "21:10",
}


def _matches(value: str, query: str) -> bool:
    return query.casefold() in value.casefold()


def _repair_text(value: str | None, fallback: str = "") -> str:
    raw = str(value or "").strip()

    if raw in NULL_TEXT_VALUES:
        return fallback

    repaired = raw

    for source_encoding in ("latin1", "cp1251"):
        try:
            repaired = raw.encode(source_encoding).decode("utf-8")
            break
        except UnicodeError:
            continue

    repaired = repaired.replace("\\n", " ").replace("\n", " ").replace("*", "")
    repaired = re.sub(r"\s+", " ", repaired)
    return repaired.strip() or fallback


def _to_mojibake(value: str) -> str:
    try:
        return value.encode("utf-8").decode("cp1251")
    except UnicodeError:
        return value


def _require_session(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise RuntimeError("DATABASE_URL is required. Set it in .env or run with DEMO_MODE=true for UI preview.")

    return session


def _clean_title(value: str | None) -> str:
    title = _repair_text(value)
    title = ROOM_CAMPUS_PATTERN.sub("", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip(" -\t") or "No room"


def _infer_building(value: str | None) -> str:
    raw = _repair_text(value)
    match = ROOM_CAMPUS_PATTERN.search(raw)

    if not match:
        return BUILDING_V78

    normalized = match.group(1).upper()

    if normalized in {"MP-1", BUILDING_MP1}:
        return BUILDING_MP1

    if normalized in {"C-20", BUILDING_S20}:
        return BUILDING_S20

    return BUILDING_V78


def _room_id(building: str, title: str) -> int:
    return zlib.crc32(f"{building}:{title}".encode("utf-8")) & 0x7FFFFFFF


def _floor_from_title(title: str) -> int:
    match = re.search(r"(\d)", title)
    return int(match.group(1)) if match else 0


def _is_mappable_room_title(title: str) -> bool:
    normalized = title.casefold().strip(" .")
    return normalized not in REMOTE_ROOM_TITLES and normalized != "no room"


def _pair_time_case(values: dict[int, str]) -> str:
    branches = " ".join(f"WHEN {pair} THEN TIME '{value}'" for pair, value in values.items())
    return f"CASE lesson.pair {branches} ELSE TIME '00:00' END"


def _room_from_raw(raw_room: str | None) -> Room:
    title = _clean_title(raw_room)
    building = _infer_building(raw_room)

    return Room(
        id=_room_id(building, title),
        title=title,
        building=building,
        floor=_floor_from_title(title),
        capacity=0,
        room_type="Audience",
        map_x=0,
        map_y=0,
        map_width=12,
        map_height=12,
        zone=building,
    )


def _lesson_from_row(row) -> Lesson:
    raw_room = row.room_title
    title = _clean_title(raw_room)
    building = _infer_building(raw_room)

    return Lesson(
        id=int(row.id),
        date=row.date,
        pair=int(row.pair) if row.pair is not None else None,
        starts_at=row.starts_at,
        ends_at=row.ends_at,
        subject=_repair_text(row.subject, "Untitled subject"),
        teacher=_repair_text(row.teacher, "Teacher not specified"),
        group=_repair_text(row.group_name, "Group not specified"),
        room_id=_room_id(building, title),
        room_title=title,
        building=building,
        floor=_floor_from_title(title),
    )


def _lessons_from_rows(rows) -> list[Lesson]:
    lessons = [_lesson_from_row(row) for row in rows]
    return [lesson for lesson in lessons if _is_mappable_room_title(lesson.room_title)]


async def list_rooms(session: AsyncSession | None) -> list[Room]:
    if settings.should_use_demo_data:
        return DEMO_ROOMS

    session = _require_session(session)
    result = await session.execute(
        text(
            """
            SELECT DISTINCT room
            FROM (
                SELECT room FROM public.sc_rasp18_rooms
                UNION
                SELECT room FROM public.sc_rasp7_rooms
            ) AS source_rooms
            WHERE room IS NOT NULL
                AND btrim(room) <> ''
                AND lower(btrim(room)) NOT IN ('none', 'null')
                AND btrim(room) <> '\\N'
            ORDER BY room
            """
        )
    )

    rooms_by_key: dict[tuple[str, str], Room] = {}

    for raw_room in result.scalars().all():
        room = _room_from_raw(raw_room)
        if not _is_mappable_room_title(room.title):
            continue

        rooms_by_key[(room.building, room.title)] = room

    return sorted(
        rooms_by_key.values(),
        key=lambda room: (room.building, room.floor, room.title),
    )


async def lessons_for_date(session: AsyncSession | None, target_date: date) -> list[Lesson]:
    if settings.should_use_demo_data:
        return [lesson for lesson in demo_lessons() if lesson.date == target_date]

    session = _require_session(session)
    result = await session.execute(
        await _lesson_query_for_date(session, target_date, "day.day = :target_date"),
        {"target_date": target_date},
    )
    return _lessons_from_rows(result.mappings().all())


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
    if settings.should_use_demo_data:
        return [
            lesson
            for lesson in demo_lessons()
            if lesson.date == target_date and _matches(lesson.teacher, query)
        ]

    session = _require_session(session)
    result = await session.execute(
        await _lesson_query_for_date(
            session,
            target_date,
            "day.day = :target_date AND (preps.teacher ILIKE :query OR preps.teacher ILIKE :query_mojibake)"
        ),
        {"target_date": target_date, "query": f"%{query}%", "query_mojibake": f"%{_to_mojibake(query)}%"},
    )
    return _lessons_from_rows(result.mappings().all())


async def group_lessons_for_date(
    session: AsyncSession | None,
    query: str,
    target_date: date,
) -> list[Lesson]:
    if settings.should_use_demo_data:
        return [
            lesson
            for lesson in demo_lessons()
            if lesson.date == target_date and _matches(lesson.group, query)
        ]

    session = _require_session(session)
    result = await session.execute(
        await _lesson_query_for_date(
            session,
            target_date,
            "day.day = :target_date AND (groups.group_name ILIKE :query OR groups.group_name ILIKE :query_mojibake)"
        ),
        {"target_date": target_date, "query": f"%{query}%", "query_mojibake": f"%{_to_mojibake(query)}%"},
    )
    return _lessons_from_rows(result.mappings().all())


async def _lesson_query_for_date(session: AsyncSession, target_date: date, where_clause: str):
    if await _should_use_template_schedule(session, target_date):
        return _template_lesson_query(where_clause)

    return _dated_lesson_query(where_clause)


async def _should_use_template_schedule(session: AsyncSession, target_date: date) -> bool:
    result = await session.execute(
        text(
            """
            SELECT
                (
                    SELECT count(*)
                    FROM public.sc_rasp18 AS lesson
                    JOIN public.sc_rasp18_days AS day ON day.id = lesson.day_id
                    JOIN public.sc_rasp18_rooms AS room_link ON room_link.rasp18_id = lesson.id
                    WHERE day.day = :target_date
                        AND room_link.room IS NOT NULL
                        AND btrim(room_link.room) <> ''
                        AND lower(btrim(room_link.room)) NOT IN ('none', 'null')
                        AND btrim(room_link.room) <> '\\N'
                ) AS dated_rows,
                (
                    SELECT count(*)
                    FROM public.sc_rasp7 AS lesson
                    JOIN public.sc_rasp18_days AS day
                        ON day.semcode = lesson.semcode
                        AND day.weekday = lesson.weekday
                        AND day.week = ANY(lesson.weeksarray)
                    JOIN public.sc_rasp7_rooms AS room_link ON room_link.rasp7_id = lesson.id
                    WHERE day.day = :target_date
                        AND room_link.room IS NOT NULL
                        AND btrim(room_link.room) <> ''
                        AND lower(btrim(room_link.room)) NOT IN ('none', 'null')
                        AND btrim(room_link.room) <> '\\N'
                ) AS template_rows
            """
        ),
        {"target_date": target_date},
    )
    row = result.mappings().one()

    # Some dates in sc_rasp18 have lessons but no room links. Use sc_rasp7 only
    # when it contains a fuller room-bound schedule for the same academic day.
    return int(row["template_rows"] or 0) > int(row["dated_rows"] or 0)


def _dated_lesson_query(where_clause: str):
    return text(
        f"""
        WITH groups AS (
            SELECT
                rel.rasp18_id,
                string_agg(DISTINCT replace(gr.title, '*', ''), ', ' ORDER BY replace(gr.title, '*', '')) AS group_name
            FROM public.sc_rasp18_groups AS rel
            JOIN public.sc_group AS gr ON gr.id = rel.group_id
            GROUP BY rel.rasp18_id
        ),
        preps AS (
            SELECT
                rel.rasp18_id,
                string_agg(DISTINCT replace(prep.fio, '*', ''), ', ' ORDER BY replace(prep.fio, '*', '')) AS teacher
            FROM public.sc_rasp18_preps AS rel
            JOIN public.sc_prep AS prep ON prep.id = rel.prep_id
            GROUP BY rel.rasp18_id
        )
        SELECT
            (lesson.id * 1000000 + room_link.id) AS id,
            day.day AS date,
            lesson.pair AS pair,
            lesson.timestart::time AS starts_at,
            lesson.timeend::time AS ends_at,
            COALESCE(NULLIF(disc.title, ''), NULLIF(disc.shorttitle, ''), 'Untitled subject') AS subject,
            COALESCE(preps.teacher, 'Teacher not specified') AS teacher,
            COALESCE(groups.group_name, 'Group not specified') AS group_name,
            room_link.room AS room_title
        FROM public.sc_rasp18 AS lesson
        JOIN public.sc_rasp18_days AS day ON day.id = lesson.day_id
        JOIN public.sc_rasp18_rooms AS room_link ON room_link.rasp18_id = lesson.id
        LEFT JOIN public.sc_disc AS disc ON disc.id = lesson.disc_id
        LEFT JOIN groups ON groups.rasp18_id = lesson.id
        LEFT JOIN preps ON preps.rasp18_id = lesson.id
        WHERE {where_clause}
            AND room_link.room IS NOT NULL
            AND btrim(room_link.room) <> ''
            AND lower(btrim(room_link.room)) NOT IN ('none', 'null')
            AND btrim(room_link.room) <> '\\N'
        ORDER BY day.day, lesson.pair, lesson.timestart::time, room_link.room
        """
    )


def _template_lesson_query(where_clause: str):
    return text(
        f"""
        WITH groups AS (
            SELECT
                rel.rasp7_id,
                string_agg(DISTINCT replace(gr.title, '*', ''), ', ' ORDER BY replace(gr.title, '*', '')) AS group_name
            FROM public.sc_rasp7_groups AS rel
            JOIN public.sc_group AS gr ON gr.id = rel.group_id
            GROUP BY rel.rasp7_id
        ),
        preps AS (
            SELECT
                rel.rasp7_id,
                string_agg(DISTINCT replace(prep.fio, '*', ''), ', ' ORDER BY replace(prep.fio, '*', '')) AS teacher
            FROM public.sc_rasp7_preps AS rel
            JOIN public.sc_prep AS prep ON prep.id = rel.prep_id
            GROUP BY rel.rasp7_id
        )
        SELECT
            (lesson.id * 1000000 + room_link.id) AS id,
            day.day AS date,
            lesson.pair AS pair,
            {_pair_time_case(PAIR_START_TIMES)} AS starts_at,
            {_pair_time_case(PAIR_END_TIMES)} AS ends_at,
            COALESCE(NULLIF(disc.title, ''), NULLIF(disc.shorttitle, ''), 'Untitled subject') AS subject,
            COALESCE(preps.teacher, 'Teacher not specified') AS teacher,
            COALESCE(groups.group_name, 'Group not specified') AS group_name,
            room_link.room AS room_title
        FROM public.sc_rasp7 AS lesson
        JOIN public.sc_rasp18_days AS day
            ON day.semcode = lesson.semcode
            AND day.weekday = lesson.weekday
            AND day.week = ANY(lesson.weeksarray)
        JOIN public.sc_rasp7_rooms AS room_link ON room_link.rasp7_id = lesson.id
        LEFT JOIN public.sc_disc AS disc ON disc.id = lesson.disc_id
        LEFT JOIN groups ON groups.rasp7_id = lesson.id
        LEFT JOIN preps ON preps.rasp7_id = lesson.id
        WHERE {where_clause}
            AND room_link.room IS NOT NULL
            AND btrim(room_link.room) <> ''
            AND lower(btrim(room_link.room)) NOT IN ('none', 'null')
            AND btrim(room_link.room) <> '\\N'
        ORDER BY day.day, lesson.pair, starts_at, room_link.room
        """
    )
