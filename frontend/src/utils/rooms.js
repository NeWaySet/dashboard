const LOOKALIKE_LETTERS = {
  A: "\u0410",
  B: "\u0412",
  C: "\u0421",
  E: "\u0415",
  H: "\u041d",
  K: "\u041a",
  M: "\u041c",
  O: "\u041e",
  P: "\u0420",
  T: "\u0422",
  X: "\u0425",
  a: "\u0430",
  c: "\u0441",
  e: "\u0435",
  o: "\u043e",
  p: "\u0440",
  x: "\u0445",
};

export function normalizeRoomTitle(value) {
  return String(value ?? "")
    .trim()
    .replace(/[ABCEHKMOPTXaceopx]/g, (letter) => LOOKALIKE_LETTERS[letter] ?? letter)
    .replace(/\s+/g, "")
    .replace(/–|—/g, "-")
    .toLocaleLowerCase("ru-RU");
}

export function isSameRoomTitle(first, second) {
  const normalizedFirst = normalizeRoomTitle(first);
  const normalizedSecond = normalizeRoomTitle(second);

  return Boolean(normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond);
}

function getNormalizedCandidates(source, keys) {
  return Array.from(
    new Set(keys.map((key) => normalizeRoomTitle(source?.[key])).filter(Boolean)),
  );
}

export function getRoomCampusCandidates(room) {
  return getNormalizedCandidates(room, [
    "campusShortName",
    "campus",
    "campus_name",
    "campusName",
    "building",
  ]);
}

export function getLessonCampusCandidates(lesson) {
  return getNormalizedCandidates(lesson, [
    "campusShortName",
    "campus",
    "campus_name",
    "campusName",
    "building",
  ]);
}

export function hasSameCampus(room, lesson) {
  const roomCampuses = getRoomCampusCandidates(room);
  const lessonCampuses = getLessonCampusCandidates(lesson);

  if (roomCampuses.length === 0 || lessonCampuses.length === 0) {
    return true;
  }

  return roomCampuses.some((roomCampus) => lessonCampuses.includes(roomCampus));
}

export function isSameMapRoomAndLesson(room, lesson) {
  return isSameRoomTitle(room?.title, lesson?.room_title) && hasSameCampus(room, lesson);
}

function makeLookupKeys(campusCandidates, roomTitle, includeFallback) {
  const roomKey = normalizeRoomTitle(roomTitle);

  if (!roomKey) {
    return [];
  }

  const keys = campusCandidates.map((campusKey) => `${campusKey}:${roomKey}`);

  if (includeFallback || campusCandidates.length === 0) {
    keys.push(`:${roomKey}`);
  }

  return Array.from(new Set(keys));
}

export function getRoomLookupKeys(room) {
  return makeLookupKeys(getRoomCampusCandidates(room), room?.title, true);
}

export function getLessonLookupKeys(lesson) {
  const campusCandidates = getLessonCampusCandidates(lesson);

  return makeLookupKeys(campusCandidates, lesson?.room_title, campusCandidates.length === 0);
}

export function buildLessonRoomIndex(lessons) {
  const index = new Map();

  for (const lesson of lessons) {
    for (const key of getLessonLookupKeys(lesson)) {
      const roomLessons = index.get(key) ?? [];
      roomLessons.push(lesson);
      index.set(key, roomLessons);
    }
  }

  return index;
}

export function getLessonsForRoom(index, room) {
  const matches = [];
  const seenLessonIds = new Set();

  if (!index) {
    return matches;
  }

  for (const key of getRoomLookupKeys(room)) {
    for (const lesson of index.get(key) ?? []) {
      const lessonId = lesson.id ?? `${lesson.starts_at}-${lesson.ends_at}-${lesson.room_title}`;

      if (!seenLessonIds.has(lessonId)) {
        seenLessonIds.add(lessonId);
        matches.push(lesson);
      }
    }
  }

  return matches;
}

export function makeLessonRoomKey(lesson) {
  const campusKey = getLessonCampusCandidates(lesson)[0] ?? "";
  const roomKey = normalizeRoomTitle(lesson?.room_title);

  return `${campusKey}:${roomKey}`;
}

export function uniqueRoomTitlesFromLessons(lessons) {
  const titles = new Map();

  for (const lesson of lessons) {
    const normalizedTitle = normalizeRoomTitle(lesson.room_title);
    if (normalizedTitle) {
      titles.set(normalizedTitle, lesson.room_title);
    }
  }

  return Array.from(titles.values());
}
