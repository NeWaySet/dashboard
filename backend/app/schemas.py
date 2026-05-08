from datetime import date, time

from pydantic import BaseModel, ConfigDict


class Room(BaseModel):
    id: int
    title: str
    building: str
    floor: int
    capacity: int
    room_type: str
    map_x: int
    map_y: int
    map_width: int
    map_height: int
    zone: str

    model_config = ConfigDict(from_attributes=True)


class Lesson(BaseModel):
    id: int
    date: date
    starts_at: time
    ends_at: time
    subject: str
    teacher: str
    group: str
    room_id: int
    room_title: str
    building: str
    floor: int


class SearchResult(BaseModel):
    query: str
    kind: str
    lessons: list[Lesson]
    highlighted_room_ids: list[int]
    highlighted_room_titles: list[str]
