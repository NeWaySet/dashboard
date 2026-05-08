from datetime import date, time
from zoneinfo import ZoneInfo
from datetime import datetime

from app.schemas import Lesson, Room


MOSCOW_TZ = ZoneInfo("Europe/Moscow")


def moscow_today() -> date:
    return datetime.now(MOSCOW_TZ).date()


DEMO_ROOMS: list[Room] = [
    Room(
        id=107,
        title="А-107",
        building="В-78",
        floor=1,
        capacity=32,
        room_type="Лекционная",
        map_x=7,
        map_y=14,
        map_width=18,
        map_height=18,
        zone="west",
    ),
    Room(
        id=214,
        title="В-214",
        building="В-78",
        floor=2,
        capacity=24,
        room_type="Компьютерный класс",
        map_x=29,
        map_y=14,
        map_width=18,
        map_height=18,
        zone="west",
    ),
    Room(
        id=210,
        title="Б-210",
        building="В-78",
        floor=2,
        capacity=60,
        room_type="Поточная аудитория",
        map_x=55,
        map_y=10,
        map_width=34,
        map_height=22,
        zone="atrium",
    ),
    Room(
        id=308,
        title="Г-308",
        building="В-78",
        floor=3,
        capacity=28,
        room_type="Семинарская",
        map_x=8,
        map_y=55,
        map_width=20,
        map_height=21,
        zone="east",
    ),
    Room(
        id=7,
        title="Е-7",
        building="В-78",
        floor=1,
        capacity=20,
        room_type="Лаборатория",
        map_x=34,
        map_y=55,
        map_width=22,
        map_height=21,
        zone="east",
    ),
    Room(
        id=212,
        title="Д-212",
        building="В-78",
        floor=1,
        capacity=42,
        room_type="Лекционная",
        map_x=63,
        map_y=54,
        map_width=27,
        map_height=22,
        zone="east",
    ),
]


def demo_lessons() -> list[Lesson]:
    today = moscow_today()

    return [
        Lesson(
            id=1,
            date=today,
            starts_at=time(8, 30),
            ends_at=time(10, 0),
            subject="Математический анализ",
            teacher="Иванова Мария Сергеевна",
            group="ИС-21",
            room_id=107,
            room_title="А-107",
            building="В-78",
            floor=1,
        ),
        Lesson(
            id=2,
            date=today,
            starts_at=time(10, 10),
            ends_at=time(11, 40),
            subject="Проектирование интерфейсов",
            teacher="Смирнов Павел Андреевич",
            group="ПИ-31",
            room_id=214,
            room_title="В-214",
            building="В-78",
            floor=2,
        ),
        Lesson(
            id=3,
            date=today,
            starts_at=time(11, 50),
            ends_at=time(13, 20),
            subject="Базы данных",
            teacher="Кузнецов Алексей Игоревич",
            group="ИС-21",
            room_id=308,
            room_title="Г-308",
            building="В-78",
            floor=3,
        ),
        Lesson(
            id=4,
            date=today,
            starts_at=time(13, 50),
            ends_at=time(15, 20),
            subject="Архитектура ПО",
            teacher="Иванова Мария Сергеевна",
            group="ПИ-31",
            room_id=210,
            room_title="Б-210",
            building="В-78",
            floor=2,
        ),
        Lesson(
            id=5,
            date=today,
            starts_at=time(15, 30),
            ends_at=time(17, 0),
            subject="Компьютерные сети",
            teacher="Орлов Денис Викторович",
            group="КБ-22",
            room_id=7,
            room_title="Е-7",
            building="В-78",
            floor=1,
        ),
        Lesson(
            id=6,
            date=today,
            starts_at=time(17, 10),
            ends_at=time(18, 40),
            subject="Python для анализа данных",
            teacher="Смирнов Павел Андреевич",
            group="ИС-21",
            room_id=212,
            room_title="Д-212",
            building="В-78",
            floor=1,
        ),
    ]
