"use client";

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

/** Current time, refreshed about once per minute and when the tab becomes visible. */
export function useNowMinute(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());

    const intervalId = window.setInterval(refresh, TICK_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return now;
}
