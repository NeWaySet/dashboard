import { useMemo } from "react";

import { minutesToHuman } from "../utils/time.js";
import { getLessonsForRoom, normalizeRoomTitle } from "../utils/rooms.js";
import { formatRoomCapacity } from "../utils/capacity.js";

const CAPACITY_LABELS = {
  all: "anyCapacity",
  20: "20+ seats",
  40: "40+ seats",
  60: "60+ seats",
};

function getStatusLabel(activeFilter, copy) {
  if (activeFilter === "active") {
    return copy.inUse;
  }

  if (activeFilter === "free") {
    return copy.freeWord;
  }

  return copy.allRooms;
}

function getCapacityLabel(capacityFilter, copy) {
  const value = CAPACITY_LABELS[capacityFilter] ?? capacityFilter;

  return value === "anyCapacity" ? copy.anyCapacity : value;
}

function getPairLabel(selectedPair, pairOptions, copy) {
  if (selectedPair === "current") {
    return copy.currentPair;
  }

  if (selectedPair === "all") {
    return copy.allPairs;
  }

  const pair = pairOptions.find((item) => item.key === selectedPair);

  return pair ? `${pair.key} ${copy.pair}` : selectedPair;
}

export function RoomAvailabilityPanel({
  rooms,
  activeLessonRoomIndex,
  activeFilter,
  capacityFilter,
  copy,
  pairOptions,
  roomQuery,
  selectedDate,
  selectedPair,
  selectedRoomId,
  totalRoomsCount,
  onRoomQueryChange,
  onSelectRoom,
}) {
  const roomRows = useMemo(
    () => {
      const normalizedRoomQuery = normalizeRoomTitle(roomQuery);

      return rooms
        .map((room) => {
          const activeLesson = getLessonsForRoom(activeLessonRoomIndex, room)[0];

          return {
            room,
            activeLesson,
            status: activeLesson ? "active" : "free",
          };
        })
        .filter(({ room }) => {
          if (!normalizedRoomQuery) {
            return true;
          }

          return normalizeRoomTitle(room.title).includes(normalizedRoomQuery);
        })
        .filter(({ status }) => activeFilter === "all" || status === activeFilter)
        .sort((first, second) => {
          const priorityStatus = activeFilter === "active" ? "active" : "free";

          if (first.status !== second.status) {
            return first.status === priorityStatus ? -1 : 1;
          }

          return first.room.title.localeCompare(second.room.title, "ru", { numeric: true });
        });
    },
    [activeFilter, activeLessonRoomIndex, roomQuery, rooms],
  );
  const freeCount = useMemo(
    () => roomRows.filter((row) => row.status === "free").length,
    [roomRows],
  );
  const activeCount = roomRows.length - freeCount;

  return (
    <section className="availability-panel" id="availability-panel">
      <div className="availability-heading compact-availability-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>
            {getStatusLabel(activeFilter, copy)} / {getCapacityLabel(capacityFilter, copy)} /{" "}
            {getPairLabel(selectedPair, pairOptions, copy)} / {selectedDate || copy.today}
          </p>
        </div>
      </div>

      <label className="availability-room-search">
        <span>{copy.roomSearch}</span>
        <input
          autoComplete="off"
          inputMode="search"
          onChange={(event) => onRoomQueryChange(event.target.value)}
          placeholder={copy.roomPlaceholder}
          type="search"
          value={roomQuery}
        />
      </label>

      <div className="availability-summary" aria-label={copy.aria}>
        <span>
          {copy.shown} <strong>{roomRows.length}</strong>
        </span>
        <span>
          {copy.free} <strong>{freeCount}</strong>
        </span>
        <span>
          {copy.busy} <strong>{activeCount}</strong>
        </span>
        <span>
          {copy.total} <strong>{totalRoomsCount}</strong>
        </span>
      </div>

      <div className="availability-list">
        {roomRows.length === 0 ? (
          <div className="empty-state">{copy.empty}</div>
        ) : (
          roomRows.map(({ room, activeLesson, status }) => (
            <button
              className={"availability-room availability-room-" + status + (selectedRoomId === room.id ? " is-selected" : "")}
              key={room.id}
              onClick={() => onSelectRoom(room)}
              type="button"
            >
              <span className="availability-room-title">{room.title}</span>
              <span className="availability-room-meta">
                {copy.floor} {room.graphFloor} / {formatRoomCapacity(room)} /{" "}
                {status === "active" ? copy.busyWord : copy.freeWord}
              </span>
              {activeLesson ? (
                <span className="availability-room-lesson">
                  {minutesToHuman(activeLesson.starts_at)}-{minutesToHuman(activeLesson.ends_at)} /{" "}
                  {activeLesson.group} / {activeLesson.teacher}
                </span>
              ) : (
                <span className="availability-room-lesson">{copy.noLesson}</span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
