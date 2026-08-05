import { isBefore, startOfDay } from "date-fns";
import { parseDateKey, toDateKey } from "@/lib/date-utils";
import type { Task, UserProfile } from "@/lib/types";

export type TaskKind = "personal" | "family";

export function getTaskKind(
  task: Pick<Task, "requesterId" | "assigneeId">,
  currentUserId: string,
): TaskKind {
  if (task.requesterId === null && task.assigneeId === currentUserId) {
    return "personal";
  }
  if (task.requesterId !== null) {
    return "family";
  }
  return "personal";
}

/** Display helper: hide arrow for personal / legacy self-assigned tasks */
export function shouldShowMemberFlow(task: Task): boolean {
  if (task.requesterId === null) return false;
  if (
    task.requesterId &&
    task.assigneeId &&
    task.requesterId === task.assigneeId
  ) {
    return false;
  }
  return true;
}

export function getTaskMemberIds(
  kind: TaskKind,
  currentUserId: string,
  assigneeId: string,
): Pick<Task, "requesterId" | "assigneeId"> {
  if (kind === "personal") {
    return { requesterId: null, assigneeId: currentUserId };
  }
  return { requesterId: currentUserId, assigneeId };
}

export function isTaskForUser(task: Task, userId: string): boolean {
  return task.assigneeId === userId || task.requesterId === userId;
}

export function filterTasksForUser(tasks: Task[], userId: string): Task[] {
  return tasks.filter((t) => isTaskForUser(t, userId));
}

export function getTodayTodoTasks(
  tasks: Task[],
  options?: {
    userId?: string | null;
    currentUser?: UserProfile | null;
  },
): Task[] {
  const todayKey = toDateKey(new Date());
  const { userId, currentUser } = options ?? {};
  const targetId = userId ?? currentUser?.id;

  return tasks.filter((t) => {
    if (t.date !== todayKey || t.completed) return false;
    if (!targetId) return false;
    return t.assigneeId === targetId;
  });
}

export function isDateKeyOnOrAfter(
  dateKey: string,
  fromDateKey: string,
): boolean {
  const date = startOfDay(parseDateKey(dateKey));
  const from = startOfDay(parseDateKey(fromDateKey));
  return !isBefore(date, from);
}

export type RecurringDeleteMode = "single" | "fromDate" | "series";

export function getRecurringDeleteTargetIds(
  tasks: Task[],
  options: {
    familyId: string;
    recurrenceGroupId: string;
    mode: RecurringDeleteMode;
    taskId?: string;
    fromDate?: string;
  },
): string[] {
  return tasks
    .filter((task) => {
      if (task.familyId !== options.familyId) return false;
      if (task.recurrenceGroupId !== options.recurrenceGroupId) return false;

      if (options.mode === "single") {
        return task.id === options.taskId;
      }
      if (options.mode === "series") {
        return true;
      }
      if (options.mode === "fromDate" && options.fromDate) {
        return isDateKeyOnOrAfter(task.date, options.fromDate);
      }
      return false;
    })
    .map((task) => task.id);
}

export function canCurrentUserCreateTask(
  task: Pick<Task, "requesterId" | "assigneeId">,
  currentUserId: string,
): boolean {
  if (task.requesterId === null) {
    return task.assigneeId === currentUserId;
  }
  return task.requesterId === currentUserId;
}

export function toggleTaskCompleted(task: Task): Task {
  return { ...task, completed: !task.completed };
}

export function countIncompleteTasksForDate(
  tasks: Task[],
  dateKey: string,
): number {
  return tasks.filter((task) => task.date === dateKey && !task.completed).length;
}

export type CalendarTaskFilter = {
  userId?: string;
  assigneeOnly?: boolean;
};

export function matchesCalendarTask(
  task: Task,
  filter: CalendarTaskFilter,
): boolean {
  const { userId, assigneeOnly = false } = filter;
  if (!userId) return !assigneeOnly;
  if (assigneeOnly) return task.assigneeId === userId;
  return isTaskForUser(task, userId);
}

export type CalendarDayStatus = "empty" | "pending" | "allComplete";

export function getCalendarDayStatus(
  tasks: Task[],
  dateKey: string,
  filter: CalendarTaskFilter,
): {
  status: CalendarDayStatus;
  incompleteCount: number;
  totalCount: number;
} {
  const dayTasks = tasks.filter(
    (task) => task.date === dateKey && matchesCalendarTask(task, filter),
  );
  const incompleteCount = dayTasks.filter((task) => !task.completed).length;
  const totalCount = dayTasks.length;

  if (totalCount === 0) {
    return { status: "empty", incompleteCount: 0, totalCount: 0 };
  }
  if (incompleteCount > 0) {
    return { status: "pending", incompleteCount, totalCount };
  }
  return { status: "allComplete", incompleteCount: 0, totalCount };
}

export const CALENDAR_MAX_DOTS = 3;

export function getCalendarDotCount(incompleteCount: number): number {
  if (incompleteCount <= 0) return 0;
  return Math.min(incompleteCount, CALENDAR_MAX_DOTS);
}
