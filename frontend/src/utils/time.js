const MOSCOW_TIME_ZONE = "Europe/Moscow";

export const PAIR_SLOTS = [
  { key: "1", label: "1 pair", starts_at: "09:00", ends_at: "10:30" },
  { key: "2", label: "2 pair", starts_at: "10:40", ends_at: "12:10" },
  { key: "3", label: "3 pair", starts_at: "12:40", ends_at: "14:10" },
  { key: "4", label: "4 pair", starts_at: "14:20", ends_at: "15:50" },
  { key: "5", label: "5 pair", starts_at: "16:20", ends_at: "17:50" },
  { key: "6", label: "6 pair", starts_at: "18:00", ends_at: "19:30" },
  { key: "7", label: "7 pair", starts_at: "19:40", ends_at: "21:10" },
];

function toMinutes(value) {
  if (typeof value === "number") {
    return value;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getMoscowSnapshot() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(now);

  const labelParts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "long",
  }).formatToParts(now);

  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  const labelPart = (type) => labelParts.find((item) => item.type === type)?.value ?? "";
  const hours = Number(part("hour"));
  const minutes = Number(part("minute"));

  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
    label: `${part("hour")}:${part("minute")}`,
    dateIso: `${part("year")}-${part("month")}-${part("day")}`,
    dateLabel: `${labelPart("day")} ${labelPart("month")}`,
  };
}

export function getLessonState(lesson, moscowTime) {
  const start = toMinutes(lesson.starts_at);
  const end = toMinutes(lesson.ends_at);

  if (moscowTime.totalMinutes >= start && moscowTime.totalMinutes <= end) {
    return "active";
  }

  if (moscowTime.totalMinutes > end) {
    return "past";
  }

  return "future";
}

export function isLessonPast(lesson, moscowTime) {
  return getLessonState(lesson, moscowTime) === "past";
}

export function minutesToHuman(value) {
  const minutes = toMinutes(value);
  const hoursPart = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minutesPart = String(minutes % 60).padStart(2, "0");

  return `${hoursPart}:${minutesPart}`;
}

export function getCurrentPairKey(moscowTime) {
  const currentPair = PAIR_SLOTS.find((pair) => {
    const start = toMinutes(pair.starts_at);
    const end = toMinutes(pair.ends_at);

    return moscowTime.totalMinutes >= start && moscowTime.totalMinutes <= end;
  });

  return currentPair?.key ?? "";
}

export function lessonMatchesDate(lesson, selectedDate) {
  if (!selectedDate) {
    return true;
  }

  return String(lesson.date ?? "").slice(0, 10) === selectedDate;
}

export function lessonMatchesPair(lesson, selectedPair, moscowTime) {
  if (!selectedPair || selectedPair === "all") {
    return true;
  }

  const pairKey = selectedPair === "current" ? getCurrentPairKey(moscowTime) : selectedPair;

  if (!pairKey) {
    return false;
  }

  const pair = PAIR_SLOTS.find((item) => item.key === pairKey);

  if (!pair) {
    return false;
  }

  const lessonStart = toMinutes(lesson.starts_at);
  const lessonEnd = toMinutes(lesson.ends_at);
  const pairStart = toMinutes(pair.starts_at);
  const pairEnd = toMinutes(pair.ends_at);

  return lessonStart < pairEnd && lessonEnd > pairStart;
}
