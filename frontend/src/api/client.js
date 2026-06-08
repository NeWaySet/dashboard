const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const rawDetails = await response.text();
    let message = rawDetails;

    try {
      const parsedDetails = JSON.parse(rawDetails);
      message = parsedDetails.detail ?? rawDetails;
    } catch {
      message = rawDetails;
    }

    throw new Error(message || `API request failed: ${response.status}`);
  }

  return response.json();
}

export function getRooms() {
  return request("/rooms");
}

export function getTodaySchedule() {
  return request("/schedule/today");
}

export function getScheduleByDate(date) {
  if (!date) {
    return getTodaySchedule();
  }

  return request(`/schedule?date=${encodeURIComponent(date)}`);
}

export function getRoomTodayLessons(roomId) {
  return request(`/rooms/${roomId}/lessons/today`);
}

export function searchTeacher(query, date) {
  const params = new URLSearchParams({ query });

  if (date) {
    params.set("date", date);
  }

  return request(`/search/teacher?${params.toString()}`);
}

export function searchGroup(query, date) {
  const params = new URLSearchParams({ query });

  if (date) {
    params.set("date", date);
  }

  return request(`/search/group?${params.toString()}`);
}
