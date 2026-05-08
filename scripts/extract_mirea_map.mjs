import fs from "node:fs";
import path from "node:path";

const SOURCE_FILE = path.resolve(".map-source/js/662.a089272ae2449222.js");
const OUTPUT_FILE = path.resolve("frontend/src/data/mireaMap.generated.json");
const CAMPUS_NAME = "В-78";

const source = fs.readFileSync(SOURCE_FILE, "utf8");
const match = source.match(/o=JSON\.parse\('([\s\S]*?)'\),/);

if (!match) {
  throw new Error("Could not find embedded map JSON in the extracted bundle.");
}

const rawMap = JSON.parse(match[1]);
const objectsById = new Map(rawMap.objects.map((object) => [object.id, object]));

function getRoomPrefix(roomName) {
  const prefix = roomName.match(/^([А-ЯA-ZЁ]+)/u);
  return prefix?.[1] ?? "Корпус";
}

function getRoomFloor(roomName, fallbackFloor) {
  const number = roomName.match(/-(\d+)/);
  if (!number) {
    return Number(fallbackFloor);
  }

  return Number(number[1][0]);
}

function uniqueByRoomName(rooms) {
  const seen = new Set();

  return rooms.filter((room) => {
    const key = `${room.title}-${room.floor}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildFloor(floorNumber, floorData) {
  const vertexById = new Map(floorData.vertices.map((vertex) => [vertex.id, vertex]));
  const verticesByObjectId = new Map();

  for (const vertex of floorData.vertices) {
    if (!vertex.mapObjectId) {
      continue;
    }

    const object = objectsById.get(vertex.mapObjectId);
    if (!object || object.type !== "room") {
      continue;
    }

    const vertices = verticesByObjectId.get(object.id) ?? [];
    vertices.push(vertex);
    verticesByObjectId.set(object.id, vertices);
  }

  const rooms = uniqueByRoomName(
    Array.from(verticesByObjectId.entries()).map(([objectId, vertices]) => {
      const object = objectsById.get(objectId);
      const x = vertices.reduce((sum, vertex) => sum + vertex.x, 0) / vertices.length;
      const y = vertices.reduce((sum, vertex) => sum + vertex.y, 0) / vertices.length;

      return {
        id: object.id,
        title: object.name,
        building: getRoomPrefix(object.name),
        floor: getRoomFloor(object.name, floorNumber),
        graphFloor: Number(floorNumber),
        x: Math.round(x),
        y: Math.round(y),
        capacity: 0,
        room_type: "Аудитория",
      };
    }),
  ).sort((a, b) => a.title.localeCompare(b.title, "ru"));

  const edges = floorData.edges
    .map((edge) => {
      const source = vertexById.get(edge.source);
      const target = vertexById.get(edge.target);

      if (!source || !target) {
        return null;
      }

      return {
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
      };
    })
    .filter(Boolean);

  const allPoints = [
    ...rooms.map((room) => ({ x: room.x, y: room.y })),
    ...edges.flatMap((edge) => [
      { x: edge.x1, y: edge.y1 },
      { x: edge.x2, y: edge.y2 },
    ]),
  ];
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const padding = 240;

  return {
    number: Number(floorNumber),
    bounds: {
      minX: minX - padding,
      minY: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    },
    edges,
    rooms,
  };
}

const floors = Object.fromEntries(
  Object.entries(rawMap.floors)
    .map(([floorNumber, floorData]) => [floorNumber, buildFloor(floorNumber, floorData)])
    .sort(([a], [b]) => Number(b) - Number(a)),
);

const output = {
  source: "https://map.kkmbr.ru/",
  campus: CAMPUS_NAME,
  generatedAt: new Date().toISOString(),
  floors,
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  `Generated ${OUTPUT_FILE} with ${Object.values(floors).reduce(
    (sum, floor) => sum + floor.rooms.length,
    0,
  )} rooms.`,
);
