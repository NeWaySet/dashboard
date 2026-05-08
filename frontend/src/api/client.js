const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `API request failed: ${response.status}`);
  }

  return response.json();
}

export function getRooms() {
  return request("/rooms");
}

export function getTodaySchedule() {
  return request("/schedule/today");
}

export function getRoomTodayLessons(roomId) {
  return request(`/rooms/${roomId}/lessons/today`);
}

export function searchTeacher(query) {
  return request(`/search/teacher?query=${encodeURIComponent(query)}`);
}

export function searchGroup(query) {
  return request(`/search/group?query=${encodeURIComponent(query)}`);
}
