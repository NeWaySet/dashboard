export function TopBar() {
  const categories = [
    "Live map",
    "Сегодня",
    "Преподаватели",
    "Группы",
    "Свободные",
    "Корпуса",
    "Расписание",
  ];

  return (
    <header className="hero">
      <div className="aurora-orb orb-one" />
      <div className="aurora-orb orb-two" />

      <nav className="topbar" aria-label="Основная навигация">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">UD</span>
          <div>
            <strong>University Dashboard</strong>
            <span>карта занятости аудиторий</span>
          </div>
        </div>

        <a className="topbar-search" href="#schedule-search">
          <span aria-hidden="true">⌕</span>
          <span>Поиск аудитории, группы или преподавателя...</span>
        </a>

        <div className="topbar-actions">
          <a href="#schedule-search">Как это работает</a>
          <a href="#rooms-panel">Расписание</a>
          <a className="primary-action" href="#live-map">Открыть карту</a>
        </div>
      </nav>

      <div className="market-nav" aria-label="Разделы dashboard">
        {categories.map((category, index) => (
          <a className={index === 0 ? "is-active" : ""} href={index === 0 ? "#live-map" : "#schedule-search"} key={category}>
            {category}
          </a>
        ))}
      </div>

      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Live occupancy market</p>
          <h1>Кампус как лента актуальных аудиторий</h1>
          <p className="hero-lead">
            Кликайте аудитории, ищите преподавателя или группу, а dashboard подсветит нужные кабинеты
            и покажет актуальные занятия по московскому времени.
          </p>
        </div>

        <aside className="hero-card" aria-label="Состояние системы">
          <span className="hero-card-kicker">Сегодня</span>
          <strong>Live occupancy</strong>
          <p>Активные пары, свободные аудитории и быстрый переход между корпусами.</p>
          <div className="hero-card-meter">
            <span />
          </div>
        </aside>
      </div>
    </header>
  );
}
