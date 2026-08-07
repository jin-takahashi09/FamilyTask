"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppProvider";

export function AlarmWatcher() {
  const { familyTasks, updateTask } = useApp();

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const checkAlarms = () => {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      familyTasks.forEach((task) => {
        if (
          task.date === todayKey &&
          task.deadlineTime === currentTime &&
          task.alarmEnabled &&
          !task.completed
        ) {
          if (Notification.permission === "granted") {
            new Notification("タスクの締切", {
              body: `${task.title} の締切時間です`,
            });
          }
          updateTask(task.id, { alarmEnabled: false }).catch(() => {});
        }
      });
    };

    const interval = setInterval(checkAlarms, 30_000);
    return () => clearInterval(interval);
  }, [familyTasks, updateTask]);

  return null;
}
