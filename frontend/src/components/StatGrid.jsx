const STATS = [
  { key: "rooms", label: "Аудиторий", accent: "rooms" },
  { key: "active", label: "Идет сейчас", accent: "active", filter: "active" },
  { key: "free", label: "Свободные", accent: "focus", filter: "free" },
  { key: "clock", label: "Москва", accent: "clock" },
];

export function StatGrid({
  roomsCount,
  activeLessonsCount,
  freeRoomsCount,
  moscowClockLabel,
  activeAvailabilityFilter,
  onAvailabilityFilterChange,
}) {
  const values = {
    rooms: roomsCount,
    active: activeLessonsCount,
    free: freeRoomsCount,
    clock: moscowClockLabel,
  };

  return (
    <section className="stat-grid" aria-label="Сводка по расписанию">
      {STATS.map((stat) => {
        const isInteractive = Boolean(stat.filter);
        const isActive = stat.filter === activeAvailabilityFilter;
        const content = (
          <>
            <span>{stat.label}</span>
            <strong>{values[stat.key]}</strong>
          </>
        );

        return isInteractive ? (
          <button
            className={`stat-card stat-card-${stat.accent} ${isActive ? "is-selected" : ""}`}
            key={stat.key}
            onClick={() => onAvailabilityFilterChange(stat.filter)}
            type="button"
          >
            {content}
          </button>
        ) : (
          <article className={`stat-card stat-card-${stat.accent}`} key={stat.key}>
            {content}
          </article>
        );
      })}
    </section>
  );
}
