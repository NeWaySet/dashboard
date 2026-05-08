const SEARCH_LABELS = {
  teacher: {
    button: "Преподаватель",
    label: "ФИО преподавателя",
    placeholder: "Например, Иванова",
  },
  group: {
    button: "Группа",
    label: "Название группы",
    placeholder: "Например, ИС-21",
  },
  room: {
    button: "Аудитория",
    label: "Номер аудитории",
    placeholder: "Например, В-303",
  },
};

export function SearchDock({
  searchMode,
  searchQuery,
  isPending,
  result,
  highlightedCount,
  onSearchModeChange,
  onSearchQueryChange,
  onReset,
}) {
  const currentLabel = SEARCH_LABELS[searchMode] ?? SEARCH_LABELS.teacher;

  return (
    <section className="search-dock" id="schedule-search">
      <div className="search-copy">
        <p className="eyebrow">Навигация по расписанию</p>
        <h2>Найти пары на сегодня</h2>
        <p>
          Введите преподавателя, группу или аудиторию. Dashboard подсветит нужные кабинеты,
          переключит корпус и этаж, а для аудитории сразу откроет расписание справа.
        </p>
      </div>

      <div className="search-console">
        <div className="mode-toggle" aria-label="Тип поиска">
          {Object.entries(SEARCH_LABELS).map(([mode, label]) => (
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

        <label className="search-box">
          <span>{currentLabel.label}</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={currentLabel.placeholder}
          />
        </label>

        <button className="ghost-button" onClick={onReset} type="button">
          Сбросить
        </button>
      </div>

      {isPending ? <div className="search-status">Ищу совпадения...</div> : null}

      {result ? (
        <div className="result-strip">
          <strong>
            {result.kind === "room"
              ? result.room
                ? `Найдена аудитория: ${result.room.title}`
                : "Аудитория не найдена"
              : `Найдено занятий: ${result.lessons.length}`}
          </strong>
          <span>Подсвечено аудиторий: {highlightedCount}</span>
        </div>
      ) : null}
    </section>
  );
}
