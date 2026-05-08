import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { searchGroup, searchTeacher } from "./api/client.js";
import { CampusMap } from "./components/CampusMap.jsx";
import { LessonPanel } from "./components/LessonPanel.jsx";
import { RoomAvailabilityPanel } from "./components/RoomAvailabilityPanel.jsx";
import { SearchDock } from "./components/SearchDock.jsx";
import { StatGrid } from "./components/StatGrid.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { campusMaps, defaultCampusMap } from "./data/campusMaps.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { useMoscowClock } from "./hooks/useMoscowClock.js";
import {
  buildLessonRoomIndex,
  getLessonsForRoom,
  makeLessonRoomKey,
  normalizeRoomTitle,
} from "./utils/rooms.js";
import { lessonMatchesDate, lessonMatchesPair, PAIR_SLOTS } from "./utils/time.js";

const DEFAULT_FLOOR = "2";

function findFirstRoomForLessons(targetLessons) {
  const targetLessonRoomIndex = buildLessonRoomIndex(targetLessons);

  for (const campus of campusMaps) {
    for (const floor of Object.values(campus.floors)) {
      const room = floor.rooms.find((candidate) =>
        getLessonsForRoom(targetLessonRoomIndex, candidate).length > 0,
      );

      if (room) {
        return { campus, room };
      }
    }
  }

  return null;
}

function findRoomByQuery(query) {
  const normalizedQuery = normalizeRoomTitle(query);

  if (!normalizedQuery) {
    return null;
  }

  const candidates = campusMaps.flatMap((campus) =>
    Object.values(campus.floors).flatMap((floor) =>
      floor.rooms.map((room) => ({ campus, floor, room })),
    ),
  );

  return (
    candidates.find(({ room }) => normalizeRoomTitle(room.title) === normalizedQuery) ??
    candidates.find(({ room }) => normalizeRoomTitle(room.title).includes(normalizedQuery)) ??
    null
  );
}

export default function App() {
  const { rooms, lessons, isLoading, error } = useDashboardData();
  const moscowTime = useMoscowClock();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedCampus, setSelectedCampus] = useState(defaultCampusMap.shortName);
  const [activeFloor, setActiveFloor] = useState(DEFAULT_FLOOR);
  const [searchMode, setSearchMode] = useState("teacher");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPair, setSelectedPair] = useState("current");
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const currentCampus = campusMaps.find((campus) => campus.shortName === selectedCampus) ?? defaultCampusMap;
  const currentFloor = currentCampus.floors[activeFloor]
    ? activeFloor
    : Object.keys(currentCampus.floors)[0];
  const allMapRooms = useMemo(
    () => Object.values(currentCampus.floors).flatMap((floor) => floor.rooms),
    [currentCampus],
  );

  useEffect(() => {
    if (!selectedDate && moscowTime.dateIso) {
      setSelectedDate(moscowTime.dateIso);
    }
  }, [moscowTime.dateIso, selectedDate]);

  const filteredOccupancyLessons = useMemo(
    () =>
      lessons.filter(
        (lesson) =>
          lessonMatchesDate(lesson, selectedDate) &&
          lessonMatchesPair(lesson, selectedPair, moscowTime),
      ),
    [lessons, moscowTime, selectedDate, selectedPair],
  );

  const highlightedLessons = useMemo(
    () => searchResult?.lessons ?? [],
    [searchResult],
  );
  const lessonRoomIndex = useMemo(() => buildLessonRoomIndex(lessons), [lessons]);
  const selectedDateLessonRoomIndex = useMemo(
    () => buildLessonRoomIndex(lessons.filter((lesson) => lessonMatchesDate(lesson, selectedDate))),
    [lessons, selectedDate],
  );
  const activeLessonRoomIndex = useMemo(
    () => buildLessonRoomIndex(filteredOccupancyLessons),
    [filteredOccupancyLessons],
  );
  const highlightedLessonRoomIndex = useMemo(
    () => buildLessonRoomIndex(highlightedLessons),
    [highlightedLessons],
  );

  const highlightedRoomCount = useMemo(() => {
    if (searchResult?.kind === "room") {
      return searchResult.room ? 1 : 0;
    }

    const roomKeys = new Set();

    for (const lesson of highlightedLessons) {
      const key = makeLessonRoomKey(lesson);

      if (key !== ":") {
        roomKeys.add(key);
      }
    }

    return roomKeys.size;
  }, [highlightedLessons, searchResult]);

  const freeRoomsCount = useMemo(
    () =>
      allMapRooms.filter(
        (room) => getLessonsForRoom(activeLessonRoomIndex, room).length === 0,
      ).length,
    [activeLessonRoomIndex, allMapRooms],
  );

  useEffect(() => {
    if (highlightedLessons.length === 0) {
      return;
    }

    const firstHighlightedRoom = findFirstRoomForLessons(highlightedLessons);

    if (firstHighlightedRoom) {
      startTransition(() => {
        setSelectedCampus(firstHighlightedRoom.campus.shortName);
        setActiveFloor(String(firstHighlightedRoom.room.graphFloor));
      });
    }
  }, [highlightedLessons]);

  function handleCampusChange(campusName) {
    const nextCampus = campusMaps.find((campus) => campus.shortName === campusName);
    startTransition(() => {
      setSelectedCampus(campusName);
      setSelectedRoom(null);
      setSearchResult(null);
      setActiveFloor(nextCampus?.floors[DEFAULT_FLOOR] ? DEFAULT_FLOOR : Object.keys(nextCampus?.floors ?? {})[0]);
    });
  }

  useEffect(() => {
    const minimumQueryLength = searchMode === "room" ? 1 : 2;

    if (deferredQuery.length < minimumQueryLength) {
      setSearchResult(null);
      setIsSearchPending(false);
      return;
    }

    let isMounted = true;
    setIsSearchPending(true);

    const timerId = window.setTimeout(async () => {
      try {
        if (searchMode === "room") {
          const foundRoom = findRoomByQuery(deferredQuery);
          const roomLessons = foundRoom ? getLessonsForRoom(lessonRoomIndex, foundRoom.room) : [];

          if (isMounted) {
            startTransition(() => {
              setSearchResult({
                query: deferredQuery,
                kind: "room",
                lessons: roomLessons,
                highlighted_room_ids: foundRoom ? [foundRoom.room.id] : [],
                room: foundRoom?.room ?? null,
              });

              if (foundRoom) {
                setSelectedCampus(foundRoom.campus.shortName);
                setActiveFloor(String(foundRoom.room.graphFloor ?? foundRoom.floor.number));
                setSelectedRoom(foundRoom.room);
              } else {
                setSelectedRoom(null);
              }
            });
          }

          return;
        }

        const result = searchMode === "teacher"
          ? await searchTeacher(deferredQuery)
          : await searchGroup(deferredQuery);

        if (isMounted) {
          startTransition(() => {
            setSearchResult(result);
            setSelectedRoom(null);
          });
        }
      } catch {
        if (isMounted) {
          setSearchResult({
            query: deferredQuery,
            kind: searchMode,
            lessons: [],
            highlighted_room_ids: [],
          });
        }
      } finally {
        if (isMounted) {
          setIsSearchPending(false);
        }
      }
    }, 260);

    return () => {
      isMounted = false;
      window.clearTimeout(timerId);
    };
  }, [deferredQuery, lessonRoomIndex, rooms, searchMode]);

  function handleRoomSelect(room) {
    startTransition(() => {
      setSelectedRoom(room);
      setActiveFloor(String(room.graphFloor));
    });
  }

  function handleSearchModeChange(mode) {
    startTransition(() => {
      setSearchMode(mode);
      setSearchResult(null);
      setSelectedRoom(null);
    });
  }

  function handleSearchQueryChange(value) {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      startTransition(() => {
        setSelectedRoom(null);
      });
    }
  }

  function handleReset() {
    startTransition(() => {
      setSearchQuery("");
      setSearchResult(null);
      setSelectedRoom(null);
    });
  }

  function handleAvailabilityFilterChange(filter) {
    startTransition(() => {
      setAvailabilityFilter(filter);
    });

    window.requestAnimationFrame(() => {
      document
        .getElementById("availability-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (isLoading) {
    return (
      <main className="app-shell loading-shell">
        <div className="loader-card">
          <div className="loader-orbit" />
          <p>Загружаю карту и расписание...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <TopBar />

      {error ? (
        <div className="error-banner">
          Backend пока не ответил: {error}. Проверьте, что FastAPI запущен.
        </div>
      ) : null}

      <StatGrid
        activeLessonsCount={filteredOccupancyLessons.length}
        activeAvailabilityFilter={availabilityFilter}
        freeRoomsCount={freeRoomsCount}
        moscowClockLabel={moscowTime.label}
        onAvailabilityFilterChange={handleAvailabilityFilterChange}
        roomsCount={allMapRooms.length || rooms.length}
      />

      <SearchDock
        highlightedCount={highlightedRoomCount}
        isPending={isSearchPending}
        result={searchResult}
        searchMode={searchMode}
        searchQuery={searchQuery}
        onReset={handleReset}
        onSearchModeChange={handleSearchModeChange}
        onSearchQueryChange={handleSearchQueryChange}
      />

      <div className="workspace-grid">
        <CampusMap
          activeLessonRoomIndex={activeLessonRoomIndex}
          campus={currentCampus}
          campusOptions={campusMaps}
          floor={currentFloor}
          floors={currentCampus.floors}
          highlightedLessonRoomIndex={highlightedLessonRoomIndex}
          lessonRoomIndex={lessonRoomIndex}
          moscowTime={moscowTime}
          searchedRoomId={searchResult?.kind === "room" ? searchResult.room?.id : null}
          selectedRoomId={selectedRoom?.id}
          onCampusChange={handleCampusChange}
          onFloorChange={setActiveFloor}
          onSelectRoom={handleRoomSelect}
        />
      </div>

      {selectedRoom ? (
        <>
          <button
            aria-label="Закрыть расписание аудитории"
            className="drawer-backdrop"
            onClick={() => setSelectedRoom(null)}
            type="button"
          />
          <LessonPanel
            lessonRoomIndex={selectedDateLessonRoomIndex}
            moscowTime={moscowTime}
            selectedDate={selectedDate}
            selectedRoom={selectedRoom}
            onClose={() => setSelectedRoom(null)}
          />
        </>
      ) : null}

      <RoomAvailabilityPanel
        activeFilter={availabilityFilter}
        activeLessonRoomIndex={activeLessonRoomIndex}
        pairOptions={PAIR_SLOTS}
        rooms={allMapRooms}
        selectedDate={selectedDate}
        selectedPair={selectedPair}
        selectedRoomId={selectedRoom?.id}
        onDateChange={setSelectedDate}
        onFilterChange={setAvailabilityFilter}
        onPairChange={setSelectedPair}
        onSelectRoom={handleRoomSelect}
      />
    </main>
  );
}
