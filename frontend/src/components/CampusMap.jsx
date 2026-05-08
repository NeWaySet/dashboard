import { useEffect, useMemo, useRef, useState } from "react";

import { getLessonState } from "../utils/time.js";
import { getLessonsForRoom } from "../utils/rooms.js";

const MIN_ZOOM = 0.82;
const MAX_ZOOM = 8;
const INITIAL_ZOOM = 1.75;
const DRAG_THRESHOLD = 6;

export function CampusMap({
  campus,
  campusOptions,
  floor,
  floors,
  lessonRoomIndex,
  highlightedLessonRoomIndex,
  searchedRoomId,
  selectedRoomId,
  activeLessonRoomIndex,
  moscowTime,
  onCampusChange,
  onFloorChange,
  onSelectRoom,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const lastDragRef = useRef(null);
  const touchPanRef = useRef(null);
  const floorEntries = useMemo(
    () =>
      Object.entries(floors).sort(
        ([first], [second]) => Number(second) - Number(first),
      ),
    [floors],
  );
  const currentFloor = floors[floor] ?? floorEntries[0]?.[1];
  const hasOriginalSvg = Boolean(currentFloor.svgUrl);
  const buildings = useMemo(
    () => (hasOriginalSvg ? [] : getBuildingLabels(currentFloor.rooms)),
    [currentFloor.rooms, hasOriginalSvg],
  );
  const initialViewBox = useMemo(
    () => getInitialViewBox(currentFloor.bounds),
    [currentFloor.bounds],
  );
  const [viewBox, setViewBox] = useState(initialViewBox);
  const [isCampusMenuOpen, setIsCampusMenuOpen] = useState(false);

  useEffect(() => {
    setViewBox(getInitialViewBox(currentFloor.bounds));
    dragRef.current = null;
    lastDragRef.current = null;
    touchPanRef.current = null;
    setIsCampusMenuOpen(false);
  }, [currentFloor.bounds, campus.shortName, floor]);

  function updateViewBox(updater) {
    setViewBox((current) => clampViewBox(updater(current), currentFloor.bounds));
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      previousX: event.clientX,
      previousY: event.clientY,
      moved: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const deltaX = ((event.clientX - drag.previousX) / rect.width) * viewBox.width;
    const deltaY = ((event.clientY - drag.previousY) / rect.height) * viewBox.height;

    drag.previousX = event.clientX;
    drag.previousY = event.clientY;
    drag.moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);

    updateViewBox((current) => ({
      ...current,
      x: current.x - deltaX,
      y: current.y - deltaY,
    }));
  }

  function handlePointerUp(event) {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      lastDragRef.current = { moved: drag.moved, endedAt: Date.now() };
      dragRef.current = null;
    }
  }

  function handlePointerCancel(event) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleWheel(event) {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 1.16 : 0.84;
    zoomAroundPoint(event.clientX, event.clientY, zoomFactor);
  }

  function handleTouchStart(event) {
    if (event.touches.length < 3) {
      touchPanRef.current = null;
      return;
    }

    event.preventDefault();
    touchPanRef.current = getTouchCenter(event.touches);
  }

  function handleTouchMove(event) {
    const previousTouch = touchPanRef.current;
    const svg = svgRef.current;

    if (!previousTouch || event.touches.length < 3 || !svg) {
      return;
    }

    event.preventDefault();
    const nextTouch = getTouchCenter(event.touches);
    const rect = svg.getBoundingClientRect();
    const deltaX = ((nextTouch.x - previousTouch.x) / rect.width) * viewBox.width;
    const deltaY = ((nextTouch.y - previousTouch.y) / rect.height) * viewBox.height;

    touchPanRef.current = nextTouch;
    updateViewBox((current) => ({
      ...current,
      x: current.x - deltaX,
      y: current.y - deltaY,
    }));
  }

  function handleTouchEnd(event) {
    if (event.touches.length < 3) {
      touchPanRef.current = null;
    }
  }

  function zoomAroundPoint(clientX, clientY, factor) {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const pointerX = (clientX - rect.left) / rect.width;
    const pointerY = (clientY - rect.top) / rect.height;

    updateViewBox((current) => {
      const nextWidth = current.width * factor;
      const nextHeight = current.height * factor;
      const boundedSize = clampViewBoxSize(
        { width: nextWidth, height: nextHeight },
        currentFloor.bounds,
      );

      return {
        width: boundedSize.width,
        height: boundedSize.height,
        x: current.x + (current.width - boundedSize.width) * pointerX,
        y: current.y + (current.height - boundedSize.height) * pointerY,
      };
    });
  }

  function handleZoomIn() {
    zoomAroundMapCenter(0.72);
  }

  function handleZoomOut() {
    zoomAroundMapCenter(1.22);
  }

  function handleResetView() {
    setViewBox(getFitViewBox(currentFloor.bounds));
  }

  function zoomAroundMapCenter(factor) {
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    zoomAroundPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function stopMapControlEvent(event) {
    event.stopPropagation();
  }

  function runMapControl(event, action) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  function handleRoomClick(room) {
    const drag = lastDragRef.current;

    if (drag?.moved > DRAG_THRESHOLD && Date.now() - (drag.endedAt ?? 0) < 180) {
      return;
    }

    onSelectRoom(room);
  }

  function handleCampusSelect(campusName) {
    setIsCampusMenuOpen(false);
    onCampusChange(campusName);
  }

  return (
    <section className="map-shell" id="live-map" aria-label="Интерактивная карта вуза">
      <div className="map-header">
        <div>
          <p className="eyebrow">Интерактивная карта кампуса</p>
          <h2>{campus.shortName}: схема аудиторий</h2>
          <div className="map-title-row">
            <p className="map-subtitle">{campus.description}</p>
            <span className={`map-precision map-precision-${campus.precision ?? "approximate"}`}>
              {(campus.precision ?? "approximate") === "exact"
                ? "точные зоны"
                : "приближённые зоны"}
            </span>
          </div>
        </div>

        <div className="map-tools">
          <div className={`campus-select ${isCampusMenuOpen ? "is-open" : ""}`}>
            <span>Корпус</span>
            <button
              aria-expanded={isCampusMenuOpen}
              aria-haspopup="listbox"
              className="campus-select-trigger"
              onClick={() => setIsCampusMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {campus.shortName}
              <span aria-hidden="true">⌄</span>
            </button>
            {isCampusMenuOpen ? (
              <div className="campus-select-menu" role="listbox">
                {campusOptions.map((option) => (
                  <button
                    aria-selected={option.shortName === campus.shortName}
                    className={option.shortName === campus.shortName ? "is-active" : ""}
                    key={option.shortName}
                    onClick={() => handleCampusSelect(option.shortName)}
                    role="option"
                    type="button"
                  >
                    {option.shortName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="floor-switcher" aria-label="Выбор этажа">
            {floorEntries.map(([floorNumber]) => (
              <button
                className={floorNumber === floor ? "is-active" : ""}
                key={floorNumber}
                onClick={() => onFloorChange(floorNumber)}
                type="button"
              >
                {floorNumber}
              </button>
            ))}
          </div>

          <div className="map-legend">
            <span>
              <i className="legend-dot legend-active" /> идет пара
            </span>
            <span>
              <i className="legend-dot legend-highlight" /> найдено
            </span>
            <span>
              <i className="legend-dot legend-free" /> аудитория
            </span>
          </div>
        </div>
      </div>

      <div
        className="campus-map"
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
      >
        <div className="map-glow map-glow-left" />
        <div className="map-glow map-glow-right" />
        <div
          className="map-zoom-controls"
          aria-label="Управление картой"
          onClick={stopMapControlEvent}
          onPointerDown={stopMapControlEvent}
          onPointerUp={stopMapControlEvent}
          onTouchStart={stopMapControlEvent}
          onWheel={stopMapControlEvent}
        >
          <button
            aria-label="Приблизить карту"
            onClick={(event) => runMapControl(event, handleZoomIn)}
            title="Приблизить"
            type="button"
          >
            +
          </button>
          <button
            aria-label="Отдалить карту"
            onClick={(event) => runMapControl(event, handleZoomOut)}
            title="Отдалить"
            type="button"
          >
            -
          </button>
          <button
            aria-label="Показать карту целиком"
            onClick={(event) => runMapControl(event, handleResetView)}
            title="Показать целиком"
            type="button"
          >
            fit
          </button>
        </div>
        <svg
          className={`campus-svg ${hasOriginalSvg ? "has-original-map" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerCancel={handlePointerCancel}
          onPointerUp={handlePointerUp}
          ref={svgRef}
          role="img"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        >
          <title>
            Карта корпуса {campus.shortName}, этаж {floor}
          </title>

          <rect
            className="map-whiteboard"
            height={currentFloor.bounds.height}
            width={currentFloor.bounds.width}
            x={currentFloor.bounds.minX}
            y={currentFloor.bounds.minY}
          />

          {hasOriginalSvg ? (
            <image
              className="map-original-svg"
              href={currentFloor.svgUrl}
              height={currentFloor.bounds.height}
              preserveAspectRatio="xMidYMid meet"
              width={currentFloor.bounds.width}
              x={currentFloor.bounds.minX}
              y={currentFloor.bounds.minY}
            />
          ) : (
            <g className="map-edge-layer">
              {currentFloor.edges.map((edge, index) => (
                <line
                  className="map-edge"
                  key={`${edge.x1}-${edge.y1}-${edge.x2}-${edge.y2}-${index}`}
                  x1={edge.x1}
                  x2={edge.x2}
                  y1={edge.y1}
                  y2={edge.y2}
                />
              ))}
            </g>
          )}

          {!hasOriginalSvg ? (
            <g className="map-building-labels">
              {buildings.map((building) => (
                <text key={building.name} x={building.x} y={building.y}>
                  {building.name}
                </text>
              ))}
            </g>
          ) : null}

          <g className="map-room-layer">
            {currentFloor.rooms.map((room) => {
              const roomLessons = getLessonsForRoom(lessonRoomIndex, room);
              const activeRoomLessons = getLessonsForRoom(activeLessonRoomIndex, room);
              const currentLesson = activeRoomLessons[0] ?? roomLessons.find(
                (lesson) => getLessonState(lesson, moscowTime) === "active",
              );
              const isActive = Boolean(currentLesson);
              const isHighlighted = getLessonsForRoom(highlightedLessonRoomIndex, room).length > 0;
              const isSearchMatch = searchedRoomId === room.id;
              const isSelected = selectedRoomId === room.id;
              const status = isActive ? "active" : isHighlighted ? "highlighted" : "free";
              const roomBox = getRoomBox(room);

              return (
                <g
                  aria-label={`Аудитория ${room.title}`}
                  className={`map-room-node map-room-${status} ${isSearchMatch ? "is-search-match" : ""} ${
                    isSelected ? "is-selected" : ""
                  }`}
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectRoom(room);
                    }
                  }}
                  role="button"
                  tabIndex="0"
                >
                  <rect
                    className="map-room-hitbox"
                    height={roomBox.height}
                    rx={roomBox.hitboxRadius}
                    transform={roomBox.transform}
                    width={roomBox.width}
                    x={roomBox.x}
                    y={roomBox.y}
                  />
                  <rect
                    className="map-room-visual"
                    height={roomBox.visualHeight}
                    rx={roomBox.visualRadius}
                    transform={roomBox.visualTransform}
                    width={roomBox.visualWidth}
                    x={roomBox.visualX}
                    y={roomBox.visualY}
                  />
                  <text
                    className="map-room-title"
                    transform={roomBox.textTransform}
                    x={roomBox.textX}
                    y={roomBox.textY}
                  >
                    {room.title}
                  </text>
                  {currentLesson ? (
                    <circle
                      className="map-room-now"
                      cx={roomBox.badgeX}
                      cy={roomBox.badgeY}
                      r="8"
                      transform={roomBox.badgeTransform}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}

function getInitialViewBox(bounds) {
  const fitViewBox = getFitViewBox(bounds);
  const nextWidth = fitViewBox.width / INITIAL_ZOOM;
  const nextHeight = fitViewBox.height / INITIAL_ZOOM;

  return {
    x: fitViewBox.x + (fitViewBox.width - nextWidth) / 2,
    y: fitViewBox.y + (fitViewBox.height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight,
  };
}

function getFitViewBox(bounds) {
  const paddingX = bounds.width * 0.04;
  const paddingY = bounds.height * 0.04;

  return {
    x: bounds.minX - paddingX,
    y: bounds.minY - paddingY,
    width: bounds.width + paddingX * 2,
    height: bounds.height + paddingY * 2,
  };
}

function clampViewBoxSize(size, bounds) {
  const minWidth = bounds.width / MAX_ZOOM;
  const minHeight = bounds.height / MAX_ZOOM;
  const maxWidth = bounds.width / MIN_ZOOM;
  const maxHeight = bounds.height / MIN_ZOOM;

  return {
    width: Math.min(Math.max(size.width, minWidth), maxWidth),
    height: Math.min(Math.max(size.height, minHeight), maxHeight),
  };
}

function clampViewBox(next, bounds) {
  const size = clampViewBoxSize(next, bounds);
  const extraX = size.width * 0.18;
  const extraY = size.height * 0.18;
  const minX = bounds.minX - extraX;
  const minY = bounds.minY - extraY;
  const maxX = bounds.minX + bounds.width - size.width + extraX;
  const maxY = bounds.minY + bounds.height - size.height + extraY;

  return {
    width: size.width,
    height: size.height,
    x: clamp(next.x, minX, Math.max(minX, maxX)),
    y: clamp(next.y, minY, Math.max(minY, maxY)),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTouchCenter(touches) {
  const points = Array.from(touches);
  const total = points.reduce(
    (sum, touch) => ({
      x: sum.x + touch.clientX,
      y: sum.y + touch.clientY,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function getRoomBox(room) {
  if (room.hitbox?.matrix) {
    const [a, b, c, d, e, f] = room.hitbox.matrix;
    const width = room.width;
    const height = room.height;
    const transform = `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
    const inset = Math.min(8, Math.max(2, Math.min(width, height) * 0.055));
    const visualWidth = Math.max(12, width - inset * 2);
    const visualHeight = Math.max(12, height - inset * 2);

    return {
      x: 0,
      y: 0,
      width,
      height,
      hitboxRadius: Math.min(14, Math.max(8, Math.min(width, height) * 0.16)),
      transform,
      visualX: inset,
      visualY: inset,
      visualWidth,
      visualHeight,
      visualRadius: Math.min(12, Math.max(6, Math.min(visualWidth, visualHeight) * 0.15)),
      visualTransform: transform,
      textTransform: transform,
      textX: width / 2,
      textY: height / 2 + 5,
      badgeTransform: transform,
      badgeX: width - Math.min(22, Math.max(12, width * 0.12)),
      badgeY: Math.min(22, Math.max(12, height * 0.18)),
    };
  }

  const width = room.width ?? Math.max(92, Math.min(180, room.title.length * 16));
  const height = room.height ?? 58;

  return {
    x: room.x - width / 2,
    y: room.y - height / 2,
    width,
    height,
    hitboxRadius: Math.min(14, Math.max(8, Math.min(width, height) * 0.16)),
    transform: undefined,
    visualX: room.x - width / 2,
    visualY: room.y - height / 2,
    visualWidth: width,
    visualHeight: height,
    visualRadius: Math.min(14, Math.max(8, Math.min(width, height) * 0.16)),
    visualTransform: undefined,
    textTransform: undefined,
    textX: room.x,
    textY: room.y + 5,
    badgeTransform: undefined,
    badgeX: room.x + width / 2 - 10,
    badgeY: room.y - height / 2 + 16,
  };
}

function getBuildingLabels(rooms) {
  const labelsByBuilding = new Map();

  for (const room of rooms) {
    const label = labelsByBuilding.get(room.building) ?? {
      name: room.building,
      count: 0,
      x: 0,
      y: 0,
    };
    label.count += 1;
    label.x += room.x;
    label.y += room.y;
    labelsByBuilding.set(room.building, label);
  }

  return Array.from(labelsByBuilding.values()).map((label) => ({
    name: label.name,
    x: label.x / label.count,
    y: label.y / label.count,
  }));
}
