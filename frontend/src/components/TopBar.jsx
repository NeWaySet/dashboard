import { SUPPORTED_LANGUAGES } from "../i18n.js";

function scrollToSection(event, href) {
  event.preventDefault();

  const target = document.querySelector(href);

  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TopBar({
  copy,
  highlightedRoomCount,
  language,
  moscowClockLabel,
  stageFloorLabel,
  stageRoomLabel,
  onLanguageChange,
}) {
  return (
    <header className="dashboard-header reference-topbar reference-topbar-hocde">
      <div className="qh-fixed-nav">
        <a className="qh-brand" href="#live-map" aria-label={copy.ariaBrand}>
          <strong>{copy.brandTitle}</strong>
          <span>{copy.brandSubtitle}</span>
        </a>

        <nav className="qh-nav-links" aria-label={copy.navAria}>
          {copy.nav.map((item) => (
            <button
              key={`${item.label}-${item.href}`}
              onClick={(event) => scrollToSection(event, item.href)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="language-switcher" aria-label={copy.languageAria}>
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              aria-pressed={language === code}
              className={language === code ? "is-active" : ""}
              key={code}
              onClick={() => onLanguageChange(code)}
              type="button"
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="qh-hero-meta" aria-label={copy.metaAria}>
        {copy.meta.map((cell) => (
          <div className="qh-meta-cell" key={cell.label}>
            <span>{cell.label}</span>
            <strong>{cell.value}</strong>
          </div>
        ))}
      </div>

      <div className="qh-media-stage" aria-hidden="true">
        <span className="qh-stage-card qh-stage-card-one">
          <em>{stageRoomLabel}</em>
        </span>
        <span className="qh-stage-card qh-stage-card-two">
          <em>{stageFloorLabel}</em>
        </span>
        <span className="qh-stage-axis qh-stage-axis-horizontal" />
        <span className="qh-stage-axis qh-stage-axis-vertical" />
      </div>

      <div className="qh-hero-status" aria-label={copy.statusAria}>
        <div>
          <span>{copy.moscowTime}</span>
          <strong>{moscowClockLabel}</strong>
        </div>
        <div>
          <span>{copy.matches}</span>
          <strong>{highlightedRoomCount}</strong>
        </div>
      </div>

      <div className="qh-hero-title" aria-label={copy.heroAria}>
        {copy.heroTitle.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </header>
  );
}
