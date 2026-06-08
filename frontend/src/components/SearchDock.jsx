import { useEffect, useMemo, useRef, useState } from "react";

import { formatRoomCapacity } from "../utils/capacity.js";
import { getLessonsForRoom } from "../utils/rooms.js";
import { minutesToHuman } from "../utils/time.js";

const STATUS_FILTERS = [
  { key: "all" },
  { key: "free" },
  { key: "active" },
];

const CAPACITY_FILTERS = [
  { key: "all" },
  { key: "20" },
  { key: "40" },
  { key: "60" },
];

const WEEKDAY_LABELS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getDateParts(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");

  if (!match) {
    const fallback = new Date();

    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
    };
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatDateValue(year, month, day) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getMonthValue(dateValue) {
  const { year, month } = getDateParts(dateValue);

  return `${year}-${padDatePart(month)}`;
}

function moveDateToMonth(dateValue, monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

  if (!match) {
    return dateValue;
  }

  const current = getDateParts(dateValue);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const clampedDay = Math.min(current.day, getDaysInMonth(year, month));

  return formatDateValue(year, month, clampedDay);
}

function moveMonthValue(monthValue, offset) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

  if (!match) {
    return getMonthValue("");
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

function getMonthCalendarCells(monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

  if (!match) {
    return [];
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;

    return {
      type: "day",
      day,
      value: formatDateValue(year, month, day),
    };
  });
  const leadingCells = Array.from({ length: firstDayOffset }, (_, index) => ({
    type: "empty",
    key: `empty-leading-${index}`,
  }));
  const trailingCount = (7 - ((leadingCells.length + dayCells.length) % 7)) % 7;
  const trailingCells = Array.from({ length: trailingCount }, (_, index) => ({
    type: "empty",
    key: `empty-trailing-${index}`,
  }));

  return [...leadingCells, ...dayCells, ...trailingCells];
}

function getCalendarLanguage(copy) {
  return copy.dateTitle === "Date" ? "en" : "ru";
}

function getMonthLabel(monthValue, calendarLanguage) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || "");

  if (!match) {
    return monthValue;
  }

  const locale = calendarLanguage === "en" ? "en-US" : "ru-RU";
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1));

  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function getPairLabel(selectedPair, pairOptions, copy) {
  if (selectedPair === "current") {
    return copy.pairCurrent;
  }

  if (selectedPair === "all") {
    return copy.pairAll;
  }

  const pair = pairOptions.find((item) => item.key === selectedPair);

  return pair ? `${pair.key} ${copy.pairShort}` : selectedPair;
}

function getStatusLabel(activeAvailabilityFilter, copy) {
  return copy.statusFilters[activeAvailabilityFilter] ?? copy.statusFilters.all;
}

function getCapacityLabel(capacityFilter, copy) {
  return copy.capacityFilters[capacityFilter] ?? capacityFilter;
}

function getAudiencePriority(activeAvailabilityFilter) {
  return activeAvailabilityFilter === "active" ? "active" : "free";
}

export function SearchDock({
  activeAvailabilityFilter,
  activeFloor,
  activeLessonRoomIndex,
  capacityFilter,
  copy,
  campusOptions,
  currentCampus,
  filteredRoomsCount,
  highlightedCount,
  isPending,
  pairOptions,
  result,
  rooms,
  searchMode,
  searchQuery,
  selectedCampus,
  selectedDate,
  selectedPair,
  selectedRoomId,
  totalRoomsCount,
  onAvailabilityFilterChange,
  onCapacityFilterChange,
  onCampusChange,
  onDateChange,
  onFloorChange,
  onPairChange,
  onReset,
  onSearchModeChange,
  onSearchQueryChange,
  onSelectRoom,
}) {
  const [openCategory, setOpenCategory] = useState(null);
  const rootRef = useRef(null);
  const currentLabel = copy.labels[searchMode] ?? copy.labels.room;
  const floorOptions = useMemo(
    () => Object.keys(currentCampus.floors).sort((first, second) => Number(second) - Number(first)),
    [currentCampus],
  );
  const audiencePriority = getAudiencePriority(activeAvailabilityFilter);
  const calendarLanguage = getCalendarLanguage(copy);
  const selectedMonth = getMonthValue(selectedDate);
  const monthCells = useMemo(() => getMonthCalendarCells(selectedMonth), [selectedMonth]);
  const monthLabel = useMemo(
    () => getMonthLabel(selectedMonth, calendarLanguage),
    [calendarLanguage, selectedMonth],
  );
  const weekdayLabels = WEEKDAY_LABELS[calendarLanguage];
  const suggestedRooms = useMemo(
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
        .sort((first, second) => {
          if (first.status !== second.status) {
            return first.status === audiencePriority ? -1 : 1;
          }

          return first.room.title.localeCompare(second.room.title, "ru", { numeric: true });
        })
        .slice(0, 18),
    [activeLessonRoomIndex, audiencePriority, rooms],
  );
  const categories = [
    { key: "location", title: copy.categories.location, value: selectedCampus },
    { key: "floor", title: copy.categories.floor, value: activeFloor },
    { key: "date", title: copy.categories.date, value: selectedDate || copy.today },
    { key: "pair", title: copy.categories.pair, value: getPairLabel(selectedPair, pairOptions, copy) },
    { key: "audience", title: copy.categories.audience, value: getStatusLabel(activeAvailabilityFilter, copy) },
    { key: "capacity", title: copy.categories.capacity, value: getCapacityLabel(capacityFilter, copy) },
  ];

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpenCategory(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenCategory(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleCategory(category) {
    setOpenCategory((current) => (current === category ? null : category));
  }

  function chooseRoom(room) {
    onSelectRoom(room);
    setOpenCategory(null);
  }

  function handleMonthChange(monthValue) {
    onDateChange(moveDateToMonth(selectedDate, monthValue));
  }

  function handleMonthStep(offset) {
    onDateChange(moveDateToMonth(selectedDate, moveMonthValue(selectedMonth, offset)));
  }

  function renderMenu() {
    if (!openCategory) {
      return null;
    }

    if (openCategory === "location") {
      return (
        <div className="inline-filter-menu inline-filter-menu-wide" role="dialog" aria-label={copy.campusSelectionAria}>
          <div className="inline-menu-heading">
            <strong>{copy.categories.location}</strong>
            <span>{copy.campusHint}</span>
          </div>
          <div className="inline-campus-list">
            {campusOptions.map((campus) => (
              <button
                className={selectedCampus === campus.shortName ? "is-active" : ""}
                key={campus.shortName}
                onClick={() => {
                  onCampusChange(campus.shortName);
                  setOpenCategory(null);
                }}
                type="button"
              >
                <strong>{campus.shortName}</strong>
                <span>{campus.description}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openCategory === "floor") {
      return (
        <div className="inline-filter-menu" role="dialog" aria-label={copy.floorSelectionAria}>
          <div className="inline-menu-heading">
            <strong>{copy.categories.floor}</strong>
            <span>{copy.floorHint}</span>
          </div>
          <div className="inline-pill-grid">
            {floorOptions.map((floor) => (
              <button
                className={String(activeFloor) === String(floor) ? "is-active" : ""}
                key={floor}
                onClick={() => {
                  onFloorChange(floor);
                  setOpenCategory(null);
                }}
                type="button"
              >
                {floor}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openCategory === "date") {
      return (
        <div className="inline-filter-menu inline-date-menu" role="dialog" aria-label={copy.dateSelectionAria}>
          <div className="inline-menu-heading">
            <strong>{copy.dateTitle}</strong>
            <span>{copy.dateHint}</span>
          </div>
          <label className="inline-date-field">
            <span>{copy.monthField}</span>
            <input type="month" value={selectedMonth} onChange={(event) => handleMonthChange(event.target.value)} />
          </label>
          <label className="inline-date-field">
            <span>{copy.dateField}</span>
            <input type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
          </label>
          <div className="inline-calendar-head">
            <button
              aria-label={calendarLanguage === "en" ? "Previous month" : "Предыдущий месяц"}
              onClick={() => handleMonthStep(-1)}
              type="button"
            >
              ←
            </button>
            <strong>{monthLabel}</strong>
            <button
              aria-label={calendarLanguage === "en" ? "Next month" : "Следующий месяц"}
              onClick={() => handleMonthStep(1)}
              type="button"
            >
              →
            </button>
          </div>
          <div className="inline-weekdays" aria-hidden="true">
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="inline-month-days" aria-label={copy.monthDaysAria}>
            {monthCells.map((item, index) =>
              item.type === "day" ? (
                <button
                  className={selectedDate === item.value ? "is-active" : ""}
                  key={item.value}
                  onClick={() => onDateChange(item.value)}
                  type="button"
                >
                  {item.day}
                </button>
              ) : (
                <span className="inline-month-empty" key={item.key ?? `empty-${index}`} />
              ),
            )}
          </div>
        </div>
      );
    }

    if (openCategory === "pair") {
      return (
        <div className="inline-filter-menu inline-filter-menu-wide" role="dialog" aria-label={copy.pairSelectionAria}>
          <div className="inline-menu-heading">
            <strong>{copy.pairTitle}</strong>
            <span>{copy.pairHint}</span>
          </div>
          <div className="inline-pill-grid inline-pair-grid">
            <button className={selectedPair === "current" ? "is-active" : ""} onClick={() => onPairChange("current")} type="button">
              {copy.pairCurrent}
            </button>
            <button className={selectedPair === "all" ? "is-active" : ""} onClick={() => onPairChange("all")} type="button">
              {copy.pairAll}
            </button>
            {pairOptions.map((pair) => (
              <button
                className={selectedPair === pair.key ? "is-active" : ""}
                key={pair.key}
                onClick={() => onPairChange(pair.key)}
                type="button"
              >
                {pair.key}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openCategory === "audience") {
      return (
        <div className="inline-filter-menu inline-audience-menu" role="dialog" aria-label={copy.statusAria}>
          <div className="inline-menu-heading">
            <strong>{copy.roomsTitle}</strong>
            <span>
              {activeAvailabilityFilter === "active"
                ? copy.busyHint
                : activeAvailabilityFilter === "free"
                  ? copy.freeHint
                  : copy.allHint}
            </span>
          </div>

          <div className="inline-segment-row" aria-label={copy.statusAria}>
            {STATUS_FILTERS.map((filter) => (
              <button
                className={activeAvailabilityFilter === filter.key ? "is-active" : ""}
                key={filter.key}
                onClick={() => onAvailabilityFilterChange(filter.key)}
                type="button"
              >
                {copy.statusFilters[filter.key]}
              </button>
            ))}
          </div>

          <div className="inline-room-suggestions">
            {suggestedRooms.map(({ room, activeLesson, status }) => (
              <button
                className={
                  "inline-room-option inline-room-option-" +
                  status +
                  (selectedRoomId === room.id ? " is-selected" : "")
                }
                key={room.id}
                onClick={() => chooseRoom(room)}
                type="button"
              >
                <span className="inline-room-title">{room.title}</span>
                <span className="inline-room-meta">
                  {copy.floorWord} {room.graphFloor} / {formatRoomCapacity(room)} /{" "}
                  {status === "active" ? copy.busyWord : copy.freeWord}
                </span>
                <span className="inline-room-note">
                  {activeLesson
                    ? `${minutesToHuman(activeLesson.starts_at)}-${minutesToHuman(activeLesson.ends_at)} / ${activeLesson.group}`
                    : copy.noLesson}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openCategory === "capacity") {
      return (
        <div className="inline-filter-menu" role="dialog" aria-label={copy.capacityTitle}>
          <div className="inline-menu-heading">
            <strong>{copy.capacityTitle}</strong>
            <span>{copy.capacityHint}</span>
          </div>
          <div className="inline-pill-grid">
            {CAPACITY_FILTERS.map((filter) => (
              <button
                className={capacityFilter === filter.key ? "is-active" : ""}
                key={filter.key}
                onClick={() => {
                  onCapacityFilterChange(filter.key);
                  setOpenCategory(null);
                }}
                type="button"
              >
                {copy.capacityFilters[filter.key]}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <section className="search-dock compact-filter-dock inline-filter-dock" id="schedule-search" ref={rootRef}>
      <div className="inline-filter-shell">
        <label className="filter-search inline-filter-search">
          <button className="inline-search-mode" onClick={() => toggleCategory("search")} type="button">
            {currentLabel.button}
          </button>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={currentLabel.placeholder}
          />
        </label>

        <div className="inline-category-row" aria-label={copy.mapFiltersAria}>
          {categories.map((category) => (
            <button
              className={"inline-category-button " + (openCategory === category.key ? "is-open" : "")}
              key={category.key}
              onClick={() => toggleCategory(category.key)}
              type="button"
            >
              <span>{category.title}</span>
              <strong>{category.value}</strong>
            </button>
          ))}
        </div>

        <button className="inline-reset-button" onClick={onReset} type="button">
          {copy.reset}
        </button>
      </div>

      {openCategory === "search" ? (
        <div className="inline-filter-menu inline-search-menu" role="dialog" aria-label={copy.searchSettingsAria}>
          <div className="inline-menu-heading">
            <strong>{copy.searchTitle}</strong>
            <span>{copy.searchHint}</span>
          </div>
          <div className="inline-segment-row">
            {Object.entries(copy.labels).map(([mode, label]) => (
              <button
                className={searchMode === mode ? "is-active" : ""}
                key={mode}
                onClick={() => onSearchModeChange(mode)}
                type="button"
              >
                {label.button}
              </button>
            ))}
          </div>
          <label className="inline-date-field">
            <span>{currentLabel.label}</span>
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={currentLabel.placeholder}
            />
          </label>
        </div>
      ) : (
        renderMenu()
      )}

      <div className="inline-filter-summary">
        <span>{copy.summaryListed}: {filteredRoomsCount} / {totalRoomsCount}</span>
        <span>{copy.summaryHighlighted}: {highlightedCount}</span>
        {isPending ? <span>{copy.searching}</span> : null}
      </div>

      {result ? (
        <div className="result-strip inline-result-strip">
          <strong>
            {result.kind === "room"
              ? result.room
                ? `${copy.roomFound}: ${result.room.title}`
                : copy.roomNotFound
              : `${copy.lessonsFound}: ${result.lessons.length}`}
          </strong>
          <span>{copy.highlightedRooms}: {highlightedCount}</span>
        </div>
      ) : null}
    </section>
  );
}
