import extraCampusRooms from "./extraCampusRooms.generated.json";
import v78Map from "./mireaMap.generated.json";
import v78ExtraRooms from "./v78ExtraRooms.generated.json";

const V78_SVG_BY_FLOOR = {
  0: "/maps/v78/floor_0.0fc9d588.svg",
  1: "/maps/v78/floor_1.162afc64.svg",
  2: "/maps/v78/floor_2.e69aa1db.svg",
  3: "/maps/v78/floor_3.84274239.svg",
  4: "/maps/v78/floor_4.2050296a.svg",
};

const S20_SVG_BY_FLOOR = {
  1: "/maps/s20/floor_1.3d6858f8.svg",
  2: "/maps/s20/floor_2.e8ff35e1.svg",
  3: "/maps/s20/floor_3.5acabcfe.svg",
  4: "/maps/s20/floor_4.985759f9.svg",
};

const MP1_SVG_BY_FLOOR = {
  "-1": "/maps/mp1/-1.f0a8357e.svg",
  1: "/maps/mp1/1.65453b62.svg",
  2: "/maps/mp1/2.049ecda8.svg",
  3: "/maps/mp1/3.c3e3e506.svg",
  4: "/maps/mp1/4.6d13f1b9.svg",
  5: "/maps/mp1/5.7470d952.svg",
};

function attachCampusToRooms(rooms, campusShortName) {
  return rooms.map((room) => ({
    ...room,
    campusShortName,
  }));
}

function mergeRooms(baseRooms, extraRooms = []) {
  const knownRoomIds = new Set(baseRooms.map((room) => String(room.id)));
  const uniqueExtraRooms = extraRooms.filter((room) => !knownRoomIds.has(String(room.id)));

  return [...baseRooms, ...uniqueExtraRooms];
}

function makeCampus(shortName, description, floors, precision = "exact") {
  return {
    shortName,
    description,
    precision,
    floors: Object.fromEntries(
      Object.entries(floors).map(([floor, value]) => [
        floor,
        {
          ...value,
          number: Number(floor),
          rooms: attachCampusToRooms(value.rooms, shortName),
        },
      ]),
    ),
  };
}

function makeGeneratedCampus(shortName, description, generatedFloors, svgByFloor) {
  return makeCampus(
    shortName,
    description,
    Object.fromEntries(
      Object.entries(generatedFloors).map(([floor, value]) => [
        floor,
        {
          ...value,
          svgUrl: svgByFloor[floor],
        },
      ]),
    ),
  );
}

function makeV78Campus() {
  return {
    shortName: "\u0412-78",
    description: "\u041f\u0440\u043e\u0441\u043f\u0435\u043a\u0442 \u0412\u0435\u0440\u043d\u0430\u0434\u0441\u043a\u043e\u0433\u043e, 78",
    precision: "exact",
    floors: Object.fromEntries(
      Object.entries(v78Map.floors).map(([floor, value]) => [
        floor,
        {
          ...value,
          svgUrl: V78_SVG_BY_FLOOR[floor],
          rooms: attachCampusToRooms(
            mergeRooms(value.rooms, v78ExtraRooms.floors[floor]),
            "\u0412-78",
          ),
          bounds: {
            minX: 0,
            minY: 0,
            width: floor === "3" ? 11080 : 11000,
            height: floor === "3" ? 9080 : 9000,
          },
        },
      ]),
    ),
  };
}

export const campusMaps = [
  makeV78Campus(),
  makeGeneratedCampus(
    "\u0421-20",
    "\u0421\u0442\u0440\u043e\u043c\u044b\u043d\u043a\u0430, 20",
    extraCampusRooms.campuses.s20.floors,
    S20_SVG_BY_FLOOR,
  ),
  makeGeneratedCampus(
    "\u041c\u041f-1",
    "\u041c\u0430\u043b\u0430\u044f \u041f\u0438\u0440\u043e\u0433\u043e\u0432\u0441\u043a\u0430\u044f, 1",
    extraCampusRooms.campuses.mp1.floors,
    MP1_SVG_BY_FLOOR,
  ),
];

export const defaultCampusMap = campusMaps[0];
