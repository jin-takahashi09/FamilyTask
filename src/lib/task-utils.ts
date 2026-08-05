import { toDateKey } from "@/lib/date-utils";
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
