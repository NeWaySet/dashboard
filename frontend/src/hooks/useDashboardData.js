import { useEffect, useState } from "react";

import { getRooms, getScheduleByDate } from "../api/client.js";

export function useDashboardData(selectedDate) {
  const [rooms, setRooms] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setIsLoading(true);
        const [roomsData, lessonsData] = await Promise.all([
          getRooms(),
          getScheduleByDate(selectedDate),
        ]);

        if (isMounted) {
          setRooms(roomsData);
          setLessons(lessonsData);
          setError("");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  return { rooms, lessons, isLoading, error };
}
