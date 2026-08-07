import { apiFetch, ApiError } from "@/lib/api/client";
import type { RepeatType, Task } from "@/lib/types";

export type ApiTask = Task;

type TasksResponse = {
  tasks: ApiTask[];
};

type TaskResponse = {
  task: ApiTask;
};

export class TaskFetchError extends Error {
  constructor(message = "タスク一覧を取得できませんでした") {
    super(message);
    this.name = "TaskFetchError";
  }
}

export class TaskActionError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "TaskActionError";
    this.status = status;
  }
}

function mapApiError(error: unknown, fallback: string): never {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      throw error;
    }
    throw new TaskActionError(error.message, error.status);
  }
  throw new TaskFetchError(fallback);
}

export type CreateTaskInput = {
  date: string;
  title: string;
  taskType: "personal" | "request";
  assigneeId: string;
  deadlineTime?: string | null;
  alarmEnabled?: boolean;
  notifyOnComplete?: boolean;
  repeatType?: RepeatType;
  repeatWeekday?: number | null;
  repeatEndDate?: string | null;
};

export type UpdateTaskInput = {
  title?: string;
  deadlineTime?: string | null;
  alarmEnabled?: boolean;
  notifyOnComplete?: boolean;
  assigneeId?: string;
  requesterId?: string | null;
  completed?: boolean;
};

export async function fetchFamilyTasks(
  familyId: string,
  options: {
    date?: string;
    assigneeId?: string;
    completed?: boolean;
  } = {},
): Promise<ApiTask[]> {
  const params = new URLSearchParams();
  if (options.date) params.set("date", options.date);
  if (options.assigneeId) params.set("assigneeId", options.assigneeId);
  if (options.completed !== undefined) {
    params.set("completed", String(options.completed));
  }

  const query = params.toString();
  const path = `/api/families/${familyId}/tasks${query ? `?${query}` : ""}`;

  try {
    const response = await apiFetch<TasksResponse>(path, { auth: true });
    return response.tasks;
  } catch (error) {
    mapApiError(error, "タスク一覧を取得できませんでした");
  }
}

export async function createFamilyTasks(
  familyId: string,
  input: CreateTaskInput,
): Promise<ApiTask[]> {
  try {
    const response = await apiFetch<TasksResponse>(
      `/api/families/${familyId}/tasks`,
      {
        method: "POST",
        auth: true,
        body: JSON.stringify(input),
      },
    );
    return response.tasks;
  } catch (error) {
    mapApiError(error, "タスクを作成できませんでした");
  }
}

export async function updateFamilyTask(
  familyId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<ApiTask> {
  try {
    const response = await apiFetch<TaskResponse>(
      `/api/families/${familyId}/tasks/${taskId}`,
      {
        method: "PUT",
        auth: true,
        body: JSON.stringify(input),
      },
    );
    return response.task;
  } catch (error) {
    mapApiError(error, "タスクを更新できませんでした");
  }
}

export async function toggleFamilyTaskCompleted(
  familyId: string,
  taskId: string,
  completed: boolean,
): Promise<ApiTask> {
  try {
    const response = await apiFetch<TaskResponse>(
      `/api/families/${familyId}/tasks/${taskId}/complete`,
      {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ completed }),
      },
    );
    return response.task;
  } catch (error) {
    mapApiError(error, "タスクの完了状態を更新できませんでした");
  }
}

export async function deleteFamilyTask(
  familyId: string,
  taskId: string,
): Promise<void> {
  try {
    await apiFetch(`/api/families/${familyId}/tasks/${taskId}`, {
      method: "DELETE",
      auth: true,
    });
  } catch (error) {
    mapApiError(error, "タスクを削除できませんでした");
  }
}

export type RecurrenceDeleteScope = "single" | "future" | "all";

export async function deleteFamilyRecurrence(
  familyId: string,
  recurrenceGroupId: string,
  input: {
    scope: RecurrenceDeleteScope;
    taskId?: string;
    fromDate?: string;
  },
): Promise<void> {
  try {
    await apiFetch(
      `/api/families/${familyId}/recurrences/${recurrenceGroupId}`,
      {
        method: "DELETE",
        auth: true,
        body: JSON.stringify(input),
      },
    );
  } catch (error) {
    mapApiError(error, "タスクを削除できませんでした");
  }
}

export function mapCreateTaskInput(
  task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">,
): CreateTaskInput {
  const taskType = task.requesterId === null ? "personal" : "request";

  return {
    date: task.date,
    title: task.title,
    taskType,
    assigneeId: task.assigneeId ?? "",
    deadlineTime: task.deadlineTime,
    alarmEnabled: task.alarmEnabled,
    notifyOnComplete: task.notifyOnComplete,
    repeatType: task.repeatType,
    repeatWeekday: task.repeatWeekday,
    repeatEndDate: task.repeatEndDate,
  };
}

export function mapUpdateTaskInput(updates: Partial<Task>): UpdateTaskInput {
  const payload: UpdateTaskInput = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.deadlineTime !== undefined) {
    payload.deadlineTime = updates.deadlineTime;
  }
  if (updates.alarmEnabled !== undefined) {
    payload.alarmEnabled = updates.alarmEnabled;
  }
  if (updates.notifyOnComplete !== undefined) {
    payload.notifyOnComplete = updates.notifyOnComplete;
  }
  if (updates.assigneeId !== undefined && updates.assigneeId !== null) {
    payload.assigneeId = updates.assigneeId;
  }
  if (updates.requesterId !== undefined) {
    payload.requesterId = updates.requesterId;
  }
  if (updates.completed !== undefined) payload.completed = updates.completed;

  return payload;
}
