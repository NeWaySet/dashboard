import { useEffect, useMemo, useRef, useState } from "react";

import { getLessonState } from "../utils/time.js";
import { getLessonsForRoom } from "../utils/rooms.js";

const MIN_ZOOM = 0.82;
const MAX_ZOOM = 8;
const INITIAL_ZOOM = 1;
const DRAG_THRESHOLD = 6;

export function CampusMap({
  campus,
  campusOptions,
  floor,
  floors,
  lessonRoomIndex,
  highlightedLessonRoomIndex,
  searchedRoomId,
  searchedRoomIds,
  selectedRoomId,
  activeLessonRoomIndex,
  moscowTime,
  copy,
  activeBlock = "all",
  blockOptions = [],
  visibleRoomIds,
  onBlockChange,
  onCampusChange,
  onFloorChange,
  onSelectRoom,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const touchPanRef = useRef(null);
  const pinchRef = useRef(null);
  const floorEntries = useMemo(
    () =>
      Object.entries(floors).sort(
        ([first], [second]) => Number(second) - Number(first),
      ),
    [floors],
  );
  const currentFloor = floors[floor] ?? floorEntries[0]?.[1];
  const hasOriginalSvg = Boolean(currentFloor.svgUrl);
  const floorRooms = useMemo(
    () =>
      visibleRoomIds
        ? currentFloor.rooms.filter((room) => visibleRoomIds.has(room.id))
        : currentFloor.rooms,
    [currentFloor.rooms, visibleRoomIds],
  );
  const buildings = useMemo(
    () => (hasOriginalSvg ? [] : getBuildingLabels(floorRooms.length > 0 ? floorRooms : currentFloor.rooms)),
    [currentFloor.rooms, floorRooms, hasOriginalSvg],
  );
  const initialViewBox = useMemo(
    () => getInitialViewBox(currentFloor.bounds, currentFloor.rooms),
    [currentFloor.bounds, currentFloor.rooms],
  );
  const [viewBox, setViewBox] = useState(initialViewBox);
  const [isCampusMenuOpen, setIsCampusMenuOpen] = useState(false);

  useEffect(() => {
    setViewBox(initialViewBox);
    dragRef.current = null;
    touchPanRef.current = null;
    pinchRef.current = null;
    setIsCampusMenuOpen(false);
  }, [initialViewBox, campus.shortName, floor]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }

    const selectedRoom = currentFloor.rooms.find((room) => room.id === selectedRoomId);

    if (!selectedRoom) {
      return;
    }

    setViewBox(getFocusedRoomViewBox(selectedRoom, currentFloor.bounds));
  }, [currentFloor.bounds, currentFloor.rooms, selectedRoomId]);

  function updateViewBox(updater) {
    setViewBox((current) => clampViewBox(updater(current), currentFloor.bounds));
  }

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const roomNode = event.target.closest?.("[data-room-id]");

    dragRef.current = {
      pointerId: event.pointerId,
      roomId: roomNode?.dataset.roomId ?? null,
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
    const pointerDeltaX = event.clientX - drag.previousX;
    const pointerDeltaY = event.clientY - drag.previousY;

    drag.previousX = event.clientX;
    drag.previousY = event.clientY;
    drag.moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    updateViewBox((current) => {
      const deltaX = (pointerDeltaX / rect.width) * current.width;
      const deltaY = (pointerDeltaY / rect.height) * current.height;

      return {
        ...current,
        x: current.x - deltaX,
        y: current.y - deltaY,
      };
    });
  }

  function handlePointerUp(event) {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      dragRef.current = null;

      if (drag.moved <= DRAG_THRESHOLD && drag.roomId) {
        const room = floorRooms.find((candidate) => String(candidate.id) === drag.roomId);

        if (room) {
          onSelectRoom(room);
        }
      }
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
    if (event.touches.length === 2) {
      event.preventDefault();
      pinchRef.current = {
        distance: getTouchDistance(event.touches),
      };
      touchPanRef.current = null;
      return;
    }

    if (event.touches.length >= 3) {
      event.preventDefault();
      touchPanRef.current = getTouchCenter(event.touches);
      pinchRef.current = null;
      return;
    }

    touchPanRef.current = null;
    pinchRef.current = null;
  }

  function handleTouchMove(event) {
    const previousTouch = touchPanRef.current;
    const previousPinch = pinchRef.current;
    const svg = svgRef.current;

    if (!svg) {
      return;
    }

    if (previousPinch && event.touches.length === 2) {
      event.preventDefault();
      const nextDistance = getTouchDistance(event.touches);
      const nextCenter = getTouchCenter(event.touches);

      if (nextDistance > 0 && previousPinch.distance > 0) {
        zoomAroundPoint(nextCenter.x, nextCenter.y, previousPinch.distance / nextDistance);
      }

      pinchRef.current = {
        distance: nextDistance,
      };
      return;
    }

    if (!previousTouch || event.touches.length < 3) {
      return;
    }

    event.preventDefault();
    const nextTouch = getTouchCenter(event.touches);
    const rect = svg.getBoundingClientRect();
    const pointerDeltaX = nextTouch.x - previousTouch.x;
    const pointerDeltaY = nextTouch.y - previousTouch.y;

    touchPanRef.current = nextTouch;

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    updateViewBox((current) => {
      const deltaX = (pointerDeltaX / rect.width) * current.width;
      const deltaY = (pointerDeltaY / rect.height) * current.height;

      return {
        ...current,
        x: current.x - deltaX,
        y: current.y - deltaY,
      };
    });
  }

  function handleTouchEnd(event) {
    if (event.touches.length < 3) {
      touchPanRef.current = null;
    }

    if (event.touches.length !== 2) {
      pinchRef.current = null;
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
    setViewBox(initialViewBox);
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

  function handleCampusSelect(campusName) {
    setIsCampusMenuOpen(false);
    onCampusChange(campusName);
  }

  return (
    <section className="map-shell" id="live-map" aria-label={copy.aria}>
      <div className="map-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{campus.shortName}: {copy.roomMapSuffix}</h2>
        </div>

        <div className="map-tools">
          <div className={`campus-select ${isCampusMenuOpen ? "is-open" : ""}`}>
            <span>{copy.campus}</span>
            <button
              aria-expanded={isCampusMenuOpen}
              aria-haspopup="listbox"
              className="campus-select-trigger"
              onClick={() => setIsCampusMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {campus.shortName}
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

          <div className="floor-switcher" aria-label={copy.floorAria}>
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

          {blockOptions.length > 1 ? (
            <div className="room-block-filter" aria-label={copy.blockFilterAria}>
              <span>{copy.corpus}</span>
              <div className="room-block-filter-grid">
                <button
                  className={activeBlock === "all" ? "is-active" : ""}
                  onClick={() => onBlockChange?.("all")}
                  type="button"
                >
                  {copy.allBlocks}
                </button>
                {blockOptions.map((block) => (
                  <button
                    className={activeBlock === block ? "is-active" : ""}
                    key={block}
                    onClick={() => onBlockChange?.(block)}
                    type="button"
                  >
                    {block}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="map-legend">
            <span>
              <i className="legend-dot legend-active" /> {copy.legendInUse}
            </span>
            <span>
              <i className="legend-dot legend-highlight" /> {copy.legendFound}
            </span>
            <span>
              <i className="legend-dot legend-free" /> {copy.legendRoom}
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
          aria-label={copy.zoomAria}
          onClick={stopMapControlEvent}
          onPointerDown={stopMapControlEvent}
          onPointerUp={stopMapControlEvent}
          onTouchStart={stopMapControlEvent}
          onWheel={stopMapControlEvent}
        >
          <button
            aria-label={copy.zoomIn}
            onClick={(event) => runMapControl(event, handleZoomIn)}
            title={copy.zoomIn}
            type="button"
          >
            +
          </button>
          <button
            aria-label={copy.zoomOut}
            onClick={(event) => runMapControl(event, handleZoomOut)}
            title={copy.zoomOut}
            type="button"
          >
            -
          </button>
          <button
            aria-label={copy.fit}
            onClick={(event) => runMapControl(event, handleResetView)}
            title={copy.fit}
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
            {copy.campus} {campus.shortName}, {copy.floor} {floor}
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
            {floorRooms.map((room) => {
              const roomLessons = getLessonsForRoom(lessonRoomIndex, room);
              const activeRoomLessons = getLessonsForRoom(activeLessonRoomIndex, room);
              const currentLesson = activeRoomLessons[0] ?? roomLessons.find(
                (lesson) => getLessonState(lesson, moscowTime) === "active",
              );
              const isActive = Boolean(currentLesson);
              const isHighlighted = getLessonsForRoom(highlightedLessonRoomIndex, room).length > 0;
              const isSearchMatch = searchedRoomId === room.id || searchedRoomIds?.has(room.id);
              const isSelected = selectedRoomId === room.id;
              const status = isActive ? "active" : isHighlighted ? "highlighted" : "free";
              const roomBox = getRoomBox(room, hasOriginalSvg);

              return (
                <g
                  aria-label={`${copy.roomAriaPrefix} ${room.title}`}
                  className={`map-room-node map-room-${status} ${isSearchMatch ? "is-search-match" : ""} ${
                    isSelected ? "is-selected" : ""
                  }`}
                  data-room-id={room.id}
                  key={room.id}
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

function getInitialViewBox(bounds, rooms) {
  const contentBounds = getRoomContentBounds(rooms, bounds);
  const fitViewBox = clampViewBox(getFitViewBox(contentBounds, 0.28), bounds);
  const nextWidth = fitViewBox.width / INITIAL_ZOOM;
  const nextHeight = fitViewBox.height / INITIAL_ZOOM;

  return clampViewBox(
    {
      x: fitViewBox.x + (fitViewBox.width - nextWidth) / 2,
      y: fitViewBox.y + (fitViewBox.height - nextHeight) / 2,
      width: nextWidth,
      height: nextHeight,
    },
    bounds,
  );
}

function getFitViewBox(bounds, paddingRatio = 0.08) {
  const paddingX = bounds.width * paddingRatio;
  const paddingY = bounds.height * paddingRatio;

  return {
    x: bounds.minX - paddingX,
    y: bounds.minY - paddingY,
    width: bounds.width + paddingX * 2,
    height: bounds.height + paddingY * 2,
  };
}

function getRoomContentBounds(rooms, fallbackBounds) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const room of rooms) {
    const box = getRawRoomBounds(room);

    if (!box) {
      continue;
    }

    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return fallbackBounds;
  }

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function getRawRoomBounds(room) {
  const width = room.width ?? Math.max(92, Math.min(180, room.title.length * 16));
  const height = room.height ?? 58;

  if (room.hitbox?.matrix) {
    const [a, b, c, d, e, f] = room.hitbox.matrix;
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([x, y]) => ({
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    }));

    const minX = Math.min(...corners.map((corner) => corner.x));
    const minY = Math.min(...corners.map((corner) => corner.y));
    const maxX = Math.max(...corners.map((corner) => corner.x));
    const maxY = Math.max(...corners.map((corner) => corner.y));

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  return {
    minX: room.x - width / 2,
    minY: room.y - height / 2,
    maxX: room.x + width / 2,
    maxY: room.y + height / 2,
    width,
    height,
  };
}

function getFocusedRoomViewBox(room, bounds) {
  const roomBounds = getRawRoomBounds(room);

  if (!roomBounds || !isFiniteBox(roomBounds)) {
    return getInitialViewBox(bounds, [room]);
  }

  const centerX = roomBounds.minX + roomBounds.width / 2;
  const centerY = roomBounds.minY + roomBounds.height / 2;
  const width = Math.max(roomBounds.width * 8, bounds.width / 11);
  const height = Math.max(roomBounds.height * 8, bounds.height / 11);

  return clampViewBox(
    {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    },
    bounds,
  );
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
  if (!isFiniteViewBox(next)) {
    return getFitViewBox(bounds, 0);
  }

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

function isFiniteBox(box) {
  return [box.minX, box.minY, box.maxX, box.maxY, box.width, box.height].every(Number.isFinite);
}

function isFiniteViewBox(box) {
  return [box.x, box.y, box.width, box.height].every(Number.isFinite);
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

function getTouchDistance(touches) {
  const [first, second] = Array.from(touches);

  if (!first || !second) {
    return 0;
  }

  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function getRoomBox(room, hasOriginalSvg = false) {
  if (room.hitbox?.matrix) {
    const [a, b, c, d, e, f] = room.hitbox.matrix;
    const width = room.width;
    const height = room.height;
    const transform = `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
    const visualInset = getRoomVisualInset(width, height, hasOriginalSvg);
    const visualWidth = Math.max(1, width - visualInset * 2);
    const visualHeight = Math.max(1, height - visualInset * 2);

    return {
      x: 0,
      y: 0,
      width,
      height,
      hitboxRadius: Math.min(14, Math.max(8, Math.min(width, height) * 0.16)),
      transform,
      visualX: visualInset,
      visualY: visualInset,
      visualWidth,
      visualHeight,
      visualRadius: Math.min(12, Math.max(6, Math.min(width, height) * 0.15)),
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
  const visualInset = getRoomVisualInset(width, height, hasOriginalSvg);
  const visualWidth = Math.max(1, width - visualInset * 2);
  const visualHeight = Math.max(1, height - visualInset * 2);

  return {
    x: room.x - width / 2,
    y: room.y - height / 2,
    width,
    height,
    hitboxRadius: Math.min(14, Math.max(8, Math.min(width, height) * 0.16)),
    transform: undefined,
    visualX: room.x - width / 2 + visualInset,
    visualY: room.y - height / 2 + visualInset,
    visualWidth,
    visualHeight,
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

function getRoomVisualInset() {
  return 0;
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
