import { useEffect, useState } from "react";

import { getMoscowSnapshot } from "../utils/time.js";

export function useMoscowClock() {
  const [snapshot, setSnapshot] = useState(() => getMoscowSnapshot());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setSnapshot(getMoscowSnapshot());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  return snapshot;
}
