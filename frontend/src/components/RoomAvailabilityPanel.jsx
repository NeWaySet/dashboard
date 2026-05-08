import { useMemo } from "react";

import { minutesToHuman } from "../utils/time.js";
import { getLessonsForRoom } from "../utils/rooms.js";

const FILTERS = [
  { key: "all", label: "Все аудитории" },
  { key: "active", label: "Заняты" },
  { key: "free", label: "Свободные" },
];

export function RoomAvailabilityPanel({
  rooms,
  activeLessonRoomIndex,
  activeFilter,
  pairOptions,
  selectedDate,
  selectedPair,
  selectedRoomId,
  onDateChange,
  onFilterChange,
  onPairChange,
  onSelectRoom,
}) {
  const roomRows = useMemo(
    () =>
      rooms
        .map((room) => {
          const activeLesson = getLessonsForRoom(activeLessonRoomIndex, room)[0];

          return {
            room,
            activeLesson,
            status: activeLesson ? "active" : "free",
          };
        })
        .filter((row) => activeFilter === "all" || row.status === activeFilter)
        .sort((first, second) => {
          if (first.status !== second.status) {
            return first.status === "active" ? -1 : 1;
          }

          return first.room.title.localeCompare(second.room.title, "ru");
        }),
    [activeFilter, activeLessonRoomIndex, rooms],
  );

  return (
    <section className="availability-panel" id="availability-panel">
      <div className="availability-heading">
        <div>
          <p className="eyebrow">Занятость аудиторий</p>
          <h2>Фильтр по дате и паре</h2>
          <p>
            Выберите дату, номер пары и режим просмотра. Карта и список покажут занятые
            и свободные аудитории текущего корпуса для выбранного интервала.
          </p>
        </div>

        <div className="availability-controls">
          <label className="date-filter">
            <span>Дата</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
            />
          </label>

          <div className="pair-filter" aria-label="Фильтр по паре">
            <button
              className={selectedPair === "current" ? "is-active" : ""}
              onClick={() => onPairChange("current")}
              type="button"
            >
              Текущая
            </button>
            <button
              className={selectedPair === "all" ? "is-active" : ""}
              onClick={() => onPairChange("all")}
              type="button"
            >
              Все пары
            </button>
            {pairOptions.map((pair) => (
              <button
                className={selectedPair === pair.key ? "is-active" : ""}
                key={pair.key}
                onClick={() => onPairChange(pair.key)}
                title={`${pair.label}: ${pair.starts_at}-${pair.ends_at}`}
                type="button"
              >
                {pair.key}
              </button>
            ))}
          </div>

          <div className="availability-tabs" aria-label="Фильтр аудиторий">
            {FILTERS.map((filter) => (
              <button
                className={activeFilter === filter.key ? "is-active" : ""}
                key={filter.key}
                onClick={() => onFilterChange(filter.key)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pair-schedule" aria-label="Расписание пар">
        {pairOptions.map((pair) => (
          <span key={pair.key}>
            {pair.label}: {pair.starts_at}-{pair.ends_at}
          </span>
        ))}
      </div>

      <div className="availability-list">
        {roomRows.length === 0 ? (
          <div className="empty-state">Для выбранного фильтра аудитории не найдены.</div>
        ) : (
          roomRows.map(({ room, activeLesson, status }) => (
            <button
              className={`availability-room availability-room-${status} ${
                selectedRoomId === room.id ? "is-selected" : ""
              }`}
              key={room.id}
              onClick={() => onSelectRoom(room)}
              type="button"
            >
              <span className="availability-room-title">{room.title}</span>
              <span className="availability-room-meta">
                этаж {room.graphFloor} · {status === "active" ? "занята" : "свободна"}
              </span>
              {activeLesson ? (
                <span className="availability-room-lesson">
                  {minutesToHuman(activeLesson.starts_at)}-{minutesToHuman(activeLesson.ends_at)} ·{" "}
                  {activeLesson.group} · {activeLesson.teacher}
                </span>
              ) : (
                <span className="availability-room-lesson">Нет пары в выбранном интервале</span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
