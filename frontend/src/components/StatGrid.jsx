const STATS = [
  { key: "rooms", accent: "rooms" },
  { key: "free", accent: "focus", filter: "free" },
  { key: "active", accent: "active", filter: "active" },
  { key: "highlighted", accent: "highlight" },
];

const ICONS = {
  rooms: "M4 5h16v14H4z M4 11h16 M10 5v14 M16 11v8",
  focus: "M12 4v16 M4 12h16 M7 7l10 10 M17 7 7 17",
  active: "M6 5h12v14H6z M9 9h6 M9 13h6 M9 17h3",
  highlight: "M12 3l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 3Z",
};

export function StatGrid({
  roomsCount,
  activeLessonsCount,
  copy,
  freeRoomsCount,
  highlightedRoomCount,
  activeAvailabilityFilter,
  onAvailabilityFilterChange,
}) {
  const values = {
    rooms: roomsCount,
    active: activeLessonsCount,
    free: freeRoomsCount,
    highlighted: highlightedRoomCount,
  };

  return (
    <section className="stat-grid reference-stat-grid" aria-label={copy.aria}>
      {STATS.map((stat) => {
        const isInteractive = Boolean(stat.filter);
        const isActive = stat.filter === activeAvailabilityFilter;
        const content = (
          <>
            <span className="stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={ICONS[stat.accent]} />
              </svg>
            </span>
            <span>{copy[stat.key].label}</span>
            <strong>{values[stat.key]}</strong>
            <small>{copy[stat.key].hint}</small>
          </>
        );

        return isInteractive ? (
          <button
            className={"stat-card stat-card-" + stat.accent + (isActive ? " is-selected" : "")}
            key={stat.key}
            onClick={() => onAvailabilityFilterChange(stat.filter)}
            type="button"
          >
            {content}
          </button>
        ) : (
          <article className={"stat-card stat-card-" + stat.accent} key={stat.key}>
            {content}
          </article>
        );
      })}
    </section>
  );
}
