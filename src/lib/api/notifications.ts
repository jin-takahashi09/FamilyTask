import { apiFetch, ApiError } from "@/lib/api/client";
import type { AppNotification } from "@/lib/types";

type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

type NotificationResponse = {
  notification: AppNotification;
};

type MarkAllReadResponse = {
  updatedCount: number;
};

export class NotificationFetchError extends Error {
  constructor(message = "通知一覧を取得できませんでした") {
    super(message);
    this.name = "NotificationFetchError";
  }
}

export class NotificationActionError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "NotificationActionError";
    this.status = status;
  }
}

function mapApiError(error: unknown, fallback: string): never {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      throw error;
    }
    throw new NotificationActionError(error.message, error.status);
  }
  throw new NotificationFetchError(fallback);
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  try {
    return await apiFetch<NotificationsResponse>("/api/notifications", {
      auth: true,
    });
  } catch (error) {
    mapApiError(error, "通知一覧を取得できませんでした");
  }
}

export async function markNotificationRead(
  notificationId: string,
): Promise<AppNotification> {
  try {
    const response = await apiFetch<NotificationResponse>(
      `/api/notifications/${notificationId}/read`,
      { method: "PATCH", auth: true },
    );
    return response.notification;
  } catch (error) {
    mapApiError(error, "通知を既読にできませんでした");
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  try {
    const response = await apiFetch<MarkAllReadResponse>(
      "/api/notifications/read-all",
      { method: "POST", auth: true },
    );
    return response.updatedCount;
  } catch (error) {
    mapApiError(error, "通知を既読にできませんでした");
  }
}
