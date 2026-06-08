export function getRoomCapacity(room) {
  const explicitCapacity = Number(room?.capacity ?? 0);

  if (Number.isFinite(explicitCapacity) && explicitCapacity > 0) {
    return Math.round(explicitCapacity);
  }

  return 0;
}

export function formatRoomCapacity(room) {
  const capacity = getRoomCapacity(room);

  return capacity > 0 ? capacity + " seats" : "capacity unknown";
}
