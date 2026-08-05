import { isSameDay, set } from "date-fns";
import { parseDateKey } from "./date-utils";
import { parseDeadlineTime } from "./time-utils";
import type { Task } from "./types";

/** Combine task date and deadline time into a local Date. */
export function getTaskDeadlineDateTime(task: Task): Date | null {
  const parsed = parseDeadlineTime(task.deadlineTime);
  if (!parsed) return null;
  const base = parseDateKey(task.date);
  return set(base, {
    hours: parsed.hour,
    minutes: parsed.minute,
    seconds: 0,
    milliseconds: 0,
  });
}

export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.completed) return false;
  const deadline = getTaskDeadlineDateTime(task);
  if (!deadline) return false;
  return now > deadline;
}

/**
 * Sort priority for "deadlineAsc":
 * 0 = overdue, 1 = today upcoming, 2 = has deadline (other dates), 3 = no deadline
 */
export function getDeadlineSortPriority(task: Task, now: Date = new Date()): number {
  const parsed = parseDeadlineTime(task.deadlineTime);
  if (!parsed) return 3;
  if (isTaskOverdue(task, now)) return 0;
  if (isSameDay(parseDateKey(task.date), now)) return 1;
  return 2;
}
