import type { Task, TaskSortOrder } from "./types";
import { getDeadlineSortPriority } from "./overdue-utils";
import { parseDeadlineTime } from "./time-utils";

export const DEFAULT_TASK_SORT_ORDER: TaskSortOrder = "createdDesc";

export const TASK_SORT_OPTIONS: {
  value: TaskSortOrder;
  label: string;
}[] = [
  { value: "deadlineAsc", label: "締切が近い順" },
  { value: "createdDesc", label: "追加が新しい順" },
  { value: "createdAsc", label: "追加が古い順" },
  { value: "titleAsc", label: "タスク名順" },
];

export function normalizeTaskSortOrder(value: unknown): TaskSortOrder {
  if (
    value === "deadlineAsc" ||
    value === "createdDesc" ||
    value === "createdAsc" ||
    value === "titleAsc"
  ) {
    return value;
  }
  return DEFAULT_TASK_SORT_ORDER;
}

function getDeadlineMinutes(task: Task): number | null {
  const parsed = parseDeadlineTime(task.deadlineTime);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

function compareCreatedAsc(a: Task, b: Task): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function compareTitleAsc(a: Task, b: Task): number {
  return a.title.localeCompare(b.title, "ja", {
    sensitivity: "base",
    numeric: true,
  });
}

function compareBySortOrder(
  a: Task,
  b: Task,
  sortOrder: TaskSortOrder,
  now: Date,
): number {
  switch (sortOrder) {
    case "deadlineAsc": {
      const aPriority = getDeadlineSortPriority(a, now);
      const bPriority = getDeadlineSortPriority(b, now);
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aMinutes = getDeadlineMinutes(a);
      const bMinutes = getDeadlineMinutes(b);
      if (aMinutes === null && bMinutes === null) {
        return compareCreatedAsc(a, b);
      }
      if (aMinutes === null) return 1;
      if (bMinutes === null) return -1;
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
      return compareCreatedAsc(a, b);
    }
    case "createdDesc":
      return b.createdAt.localeCompare(a.createdAt);
    case "createdAsc":
      return compareCreatedAsc(a, b);
    case "titleAsc":
      return compareTitleAsc(a, b);
    default:
      return 0;
  }
}

export function sortTasks(
  tasks: Task[],
  sortOrder: TaskSortOrder,
  now: Date = new Date(),
): Task[] {
  return [...tasks].sort((a, b) => compareBySortOrder(a, b, sortOrder, now));
}

export type TaskListStatusFilter = "すべて" | "未完了" | "完了済み";

/** Keep completed tasks at the end when showing all statuses. */
export function sortTasksForDisplay(
  tasks: Task[],
  sortOrder: TaskSortOrder,
  statusFilter: TaskListStatusFilter,
  now: Date = new Date(),
): Task[] {
  if (statusFilter === "未完了") {
    return sortTasks(
      tasks.filter((task) => !task.completed),
      sortOrder,
      now,
    );
  }
  if (statusFilter === "完了済み") {
    return sortTasks(
      tasks.filter((task) => task.completed),
      sortOrder,
      now,
    );
  }

  const incomplete = tasks.filter((task) => !task.completed);
  const complete = tasks.filter((task) => task.completed);
  return [
    ...sortTasks(incomplete, sortOrder, now),
    ...sortTasks(complete, sortOrder, now),
  ];
}
