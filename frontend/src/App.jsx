import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { searchGroup, searchTeacher } from "./api/client.js";
import { CampusMap } from "./components/CampusMap.jsx";
import { LessonPanel } from "./components/LessonPanel.jsx";
import { RoomAvailabilityPanel } from "./components/RoomAvailabilityPanel.jsx";
import { SearchDock } from "./components/SearchDock.jsx";
import { StatGrid } from "./components/StatGrid.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { campusMaps, defaultCampusMap } from "./data/campusMaps.js";
import { getRoomCapacity } from "./utils/capacity.js";
import { getCopy, SUPPORTED_LANGUAGES } from "./i18n.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { useMoscowClock } from "./hooks/useMoscowClock.js";
import {
  buildLessonRoomIndex,
  getLessonsForRoom,
  getRoomLookupKeys,
  makeLessonRoomKey,
  normalizeRoomTitle,
} from "./utils/rooms.js";
import { lessonMatchesDate, lessonMatchesPair, PAIR_SLOTS } from "./utils/time.js";

const DEFAULT_FLOOR = "2";

const BLOCK_LABEL_FALLBACK = "OTHER";

function getInitialLanguage() {
  if (typeof window === "undefined") {
    return "ru";
  }

  const savedLanguage = window.localStorage.getItem("dashboard-language");

  return SUPPORTED_LANGUAGES.includes(savedLanguage) ? savedLanguage : "ru";
}

function getRoomBlock(room) {
  const normalizedTitle = normalizeRoomTitle(room?.title).toLocaleUpperCase("ru-RU");
  const blockMatch = normalizedTitle.match(/^[\p{L}]+/u);

  if (blockMatch?.[0]) {
    return blockMatch[0];
  }

  const normalizedBuilding = normalizeRoomTitle(room?.building).toLocaleUpperCase("ru-RU");
  const buildingMatch = normalizedBuilding.match(/^[\p{L}]+/u);

  return buildingMatch?.[0] ?? BLOCK_LABEL_FALLBACK;
}

function getRoomBlockOptions(rooms) {
  return Array.from(new Set(rooms.map((room) => getRoomBlock(room)))).sort((first, second) =>
    first.localeCompare(second, "ru", { numeric: true }),
  );
}

function buildBackendRoomIndex(backendRooms) {
  const index = new Map();

  for (const room of backendRooms) {
    for (const key of getRoomLookupKeys(room)) {
      index.set(key, room);
    }
  }

  return index;
}

function enrichMapRoom(room, backendRoomIndex) {
  for (const key of getRoomLookupKeys(room)) {
    const backendRoom = backendRoomIndex.get(key);

    if (backendRoom) {
      return {
        ...room,
        backendRoomId: backendRoom.id,
        capacity: backendRoom.capacity ?? room.capacity ?? 0,
        room_type: backendRoom.room_type ?? room.room_type,
        source: "database",
      };
    }
  }

  return {
    ...room,
    capacity: room.capacity ?? 0,
    source: "map",
  };
}

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

function buildLocalLessonSearchResult(kind, query, lessons) {
  const normalizedQuery = query.trim().toLowerCase();
  const fieldName = kind === "group" ? "group" : "teacher";
  const matchedLessons = lessons.filter((lesson) =>
    String(lesson[fieldName] ?? "").toLowerCase().includes(normalizedQuery),
  );

  return {
    query,
    kind,
    lessons: matchedLessons,
    highlighted_room_ids: [],
  };
}

export default function App() {
  const moscowTime = useMoscowClock();
  const [language, setLanguage] = useState(getInitialLanguage);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedCampus, setSelectedCampus] = useState(defaultCampusMap.shortName);
  const [activeFloor, setActiveFloor] = useState(DEFAULT_FLOOR);
  const [searchMode, setSearchMode] = useState("room");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPair, setSelectedPair] = useState("current");
  const [roomBlockFilter, setRoomBlockFilter] = useState("all");
  const [roomListQuery, setRoomListQuery] = useState("");
  const scheduleDate = selectedDate || moscowTime.dateIso;
  const copy = useMemo(() => getCopy(language), [language]);
  const { rooms, lessons, isLoading, error } = useDashboardData(scheduleDate);
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const backendRoomIndex = useMemo(() => buildBackendRoomIndex(rooms), [rooms]);
  const currentCampusBase = campusMaps.find((campus) => campus.shortName === selectedCampus) ?? defaultCampusMap;
  const currentCampus = useMemo(
    () => ({
      ...currentCampusBase,
      floors: Object.fromEntries(
        Object.entries(currentCampusBase.floors).map(([floorNumber, floorValue]) => [
          floorNumber,
          {
            ...floorValue,
            rooms: floorValue.rooms.map((room) => enrichMapRoom(room, backendRoomIndex)),
          },
        ]),
      ),
    }),
    [backendRoomIndex, currentCampusBase],
  );
  const currentFloor = currentCampus.floors[activeFloor]
    ? activeFloor
    : Object.keys(currentCampus.floors)[0];
  const heroStageRoomLabel = selectedRoom?.title ?? selectedCampus;
  const heroStageFloorLabel = language === "ru"
    ? `Этаж ${selectedRoom?.graphFloor ?? currentFloor}`
    : `Floor ${selectedRoom?.graphFloor ?? currentFloor}`;
  const allMapRooms = useMemo(
    () => Object.values(currentCampus.floors).flatMap((floor) => floor.rooms),
    [currentCampus],
  );
  const roomBlockOptions = useMemo(() => getRoomBlockOptions(allMapRooms), [allMapRooms]);

  useEffect(() => {
    if (roomBlockFilter !== "all" && !roomBlockOptions.includes(roomBlockFilter)) {
      setRoomBlockFilter("all");
    }
  }, [roomBlockFilter, roomBlockOptions]);

  useEffect(() => {
    if (!selectedDate && moscowTime.dateIso) {
      setSelectedDate(moscowTime.dateIso);
    }
  }, [moscowTime.dateIso, selectedDate]);

  useEffect(() => {
    window.localStorage.setItem("dashboard-language", language);
    document.documentElement.lang = language;
  }, [language]);

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
  const blockFilteredRooms = useMemo(() => {
    if (roomBlockFilter === "all") {
      return allMapRooms;
    }

    return allMapRooms.filter((room) => getRoomBlock(room) === roomBlockFilter);
  }, [allMapRooms, roomBlockFilter]);
  const searchedRoomIds = useMemo(() => {
    const ids = new Set();

    if (selectedRoom?.id) {
      ids.add(selectedRoom.id);
      return ids;
    }

    if (searchResult?.kind === "room" && searchResult.room?.id) {
      ids.add(searchResult.room.id);
    }

    return ids;
  }, [searchResult, selectedRoom]);
  const capacityFilteredRooms = useMemo(() => {
    if (capacityFilter === "all") {
      return blockFilteredRooms;
    }

    const minimumCapacity = Number(capacityFilter);

    return blockFilteredRooms.filter((room) => getRoomCapacity(room) >= minimumCapacity);
  }, [blockFilteredRooms, capacityFilter]);

  useEffect(() => {
    if (highlightedLessons.length === 0) {
      return;
    }

    const firstHighlightedRoom = findFirstRoomForLessons(highlightedLessons);

    if (firstHighlightedRoom) {
      startTransition(() => {
        setSelectedCampus(firstHighlightedRoom.campus.shortName);
        setActiveFloor(String(firstHighlightedRoom.room.graphFloor));
        setRoomBlockFilter(getRoomBlock(firstHighlightedRoom.room));
      });
    }
  }, [highlightedLessons]);

  function getEnrichedRoom(room) {
    return enrichMapRoom(room, backendRoomIndex);
  }

  function handleCampusChange(campusName) {
    const nextCampus = campusMaps.find((campus) => campus.shortName === campusName);
    startTransition(() => {
      setSelectedCampus(campusName);
      setSelectedRoom(null);
      setSearchResult(null);
      setRoomBlockFilter("all");
      setRoomListQuery("");
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
        const foundRoom = findRoomByQuery(deferredQuery);

        if (searchMode === "room" || foundRoom) {
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
                setRoomBlockFilter(getRoomBlock(foundRoom.room));
                setSelectedRoom(getEnrichedRoom(foundRoom.room));
              } else {
                setSelectedRoom(null);
              }
            });
          }

          return;
        }

        const result = searchMode === "teacher"
          ? await searchTeacher(deferredQuery, scheduleDate)
          : await searchGroup(deferredQuery, scheduleDate);

        if (isMounted) {
          startTransition(() => {
            setSearchResult(result);
            setSelectedRoom(null);
          });
        }
      } catch {
        if (isMounted) {
          setSearchResult(buildLocalLessonSearchResult(searchMode, deferredQuery, lessons));
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
  }, [deferredQuery, lessonRoomIndex, lessons, rooms, scheduleDate, searchMode]);

  function handleRoomSelect(room) {
    startTransition(() => {
      setSelectedRoom(getEnrichedRoom(room));
      setActiveFloor(String(room.graphFloor));
      setRoomBlockFilter(getRoomBlock(room));
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

  function handleRoomListQueryChange(value) {
    setRoomListQuery(value);

    const normalizedQuery = normalizeRoomTitle(value);

    if (normalizedQuery.length < 2) {
      return;
    }

    const foundRoom = allMapRooms.find((room) => normalizeRoomTitle(room.title).includes(normalizedQuery));

    if (foundRoom) {
      startTransition(() => {
        setRoomBlockFilter(getRoomBlock(foundRoom));
        setActiveFloor(String(foundRoom.graphFloor));
        setSelectedRoom(getEnrichedRoom(foundRoom));
      });
    } else {
      startTransition(() => {
        setSelectedRoom(null);
      });
    }
  }

  function handleFloorChange(floor) {
    startTransition(() => {
      setActiveFloor(String(floor));
      setSelectedRoom(null);
    });
  }

  function handleReset() {
    const resetCampus = defaultCampusMap;

    startTransition(() => {
      setSearchMode("room");
      setSearchQuery("");
      setSearchResult(null);
      setSelectedRoom(null);
      setAvailabilityFilter("all");
      setCapacityFilter("all");
      setRoomBlockFilter("all");
      setRoomListQuery("");
      setSelectedDate(moscowTime.dateIso || "");
      setSelectedPair("current");
      setSelectedCampus(resetCampus.shortName);
      setActiveFloor(resetCampus.floors[DEFAULT_FLOOR] ? DEFAULT_FLOOR : Object.keys(resetCampus.floors)[0]);
    });
  }

  function handleAvailabilityFilterChange(filter) {
    startTransition(() => {
      setAvailabilityFilter(filter);
    });

    window.requestAnimationFrame(() => {
      document
        .getElementById("availability-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (isLoading) {
    return (
      <main className={`app-shell loading-shell project-dashboard reference-suite concept-hocde lang-${language}`}>
        <div className="loader-card">
          <div className="loader-meta" aria-hidden="true">
            <span>CAMPUS SYSTEM</span>
            <span>{moscowTime.label}</span>
          </div>
          <strong className="loader-word" aria-hidden="true">LOADING</strong>
          <div className="loader-orbit" />
          <p>{copy.app.loading}</p>
          <div className="loader-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`app-shell project-dashboard reference-suite concept-hocde lang-${language}`}>
      <div className="dashboard-main">
        <TopBar
          copy={copy.topBar}
          highlightedRoomCount={highlightedRoomCount}
          language={language}
          moscowClockLabel={moscowTime.label}
          stageFloorLabel={heroStageFloorLabel}
          stageRoomLabel={heroStageRoomLabel}
          onLanguageChange={setLanguage}
        />

        {error ? (
          <div className="error-banner">
            {copy.app.errorPrefix} {error}. {copy.app.errorSuffix}
          </div>
        ) : null}

        <StatGrid
          activeLessonsCount={filteredOccupancyLessons.length}
          activeAvailabilityFilter={availabilityFilter}
          freeRoomsCount={freeRoomsCount}
          highlightedRoomCount={highlightedRoomCount}
          copy={copy.stats}
          moscowClockLabel={moscowTime.label}
          onAvailabilityFilterChange={handleAvailabilityFilterChange}
          roomsCount={allMapRooms.length || rooms.length}
        />

        <SearchDock
          activeAvailabilityFilter={availabilityFilter}
          activeFloor={currentFloor}
          activeLessonRoomIndex={activeLessonRoomIndex}
          capacityFilter={capacityFilter}
          campusOptions={campusMaps}
          currentCampus={currentCampus}
          filteredRoomsCount={capacityFilteredRooms.length}
          highlightedCount={highlightedRoomCount}
          isPending={isSearchPending}
          pairOptions={PAIR_SLOTS}
          result={searchResult}
          rooms={capacityFilteredRooms}
          searchMode={searchMode}
          searchQuery={searchQuery}
          selectedCampus={selectedCampus}
          selectedDate={selectedDate}
          selectedPair={selectedPair}
          selectedRoomId={selectedRoom?.id}
          totalRoomsCount={allMapRooms.length || rooms.length}
          onAvailabilityFilterChange={setAvailabilityFilter}
          onCapacityFilterChange={setCapacityFilter}
          onCampusChange={handleCampusChange}
          onDateChange={setSelectedDate}
          onFloorChange={handleFloorChange}
          onPairChange={setSelectedPair}
          onReset={handleReset}
          onSearchModeChange={handleSearchModeChange}
          onSearchQueryChange={handleSearchQueryChange}
          onSelectRoom={handleRoomSelect}
          copy={copy.search}
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
            copy={copy.map}
            activeBlock={roomBlockFilter}
            blockOptions={roomBlockOptions}
            searchedRoomId={searchResult?.kind === "room" ? searchResult.room?.id : null}
            searchedRoomIds={searchedRoomIds}
            selectedRoomId={selectedRoom?.id}
            onBlockChange={setRoomBlockFilter}
            onCampusChange={handleCampusChange}
            onFloorChange={handleFloorChange}
            onSelectRoom={handleRoomSelect}
          />

          <RoomAvailabilityPanel
            activeFilter={availabilityFilter}
            activeLessonRoomIndex={activeLessonRoomIndex}
            capacityFilter={capacityFilter}
            copy={copy.availability}
            pairOptions={PAIR_SLOTS}
            roomQuery={roomListQuery}
            rooms={capacityFilteredRooms}
            selectedDate={selectedDate}
            selectedPair={selectedPair}
            selectedRoomId={selectedRoom?.id}
            totalRoomsCount={allMapRooms.length || rooms.length}
            onRoomQueryChange={handleRoomListQueryChange}
            onSelectRoom={handleRoomSelect}
          />
        </div>
      </div>

      {selectedRoom ? (
        <>
          <button
            aria-label={copy.app.closeDrawer}
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
            copy={copy.lessonPanel}
          />
        </>
      ) : null}
    </main>
  );
}
