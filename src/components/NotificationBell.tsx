"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { isReverbConfigured, subscribeUserNotificationChannel } from "@/lib/realtime/echo";
import type { AppNotification } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}日前`;

  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

function notificationVisual(type: string): {
  Icon: LucideIcon;
  iconWrap: string;
  iconColor: string;
} {
  switch (type) {
    case "task.assigned":
      return {
        Icon: ClipboardList,
        iconWrap: "bg-amber-100/80",
        iconColor: "text-amber-700",
      };
    case "task.completed":
      return {
        Icon: CheckCircle2,
        iconWrap: "bg-emerald-50",
        iconColor: "text-emerald-600",
      };
    case "task.due_soon":
      return {
        Icon: Clock3,
        iconWrap: "bg-orange-50",
        iconColor: "text-orange-600",
      };
    default:
      return {
        Icon: Bell,
        iconWrap: "bg-stone-100",
        iconColor: "text-stone-500",
      };
  }
}

type NotificationBellProps = {
  userId: string;
  compact?: boolean;
};

export function NotificationBell({ userId, compact = false }: NotificationBellProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  const applyResult = useCallback(
    (result: { notifications: AppNotification[]; unreadCount: number }) => {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setHasLoaded(true);
    },
    [],
  );

  const refreshSilent = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      applyResult(result);
    } catch {
      // Keep previous list on transient failures.
    }
  }, [applyResult]);

  useEffect(() => {
    let cancelled = false;

    void fetchNotifications()
      .then((result) => {
        if (!cancelled) applyResult(result);
      })
      .catch(() => {
        // ignore initial load errors
      });

    return () => {
      cancelled = true;
    };
  }, [applyResult, userId]);

  useEffect(() => {
    if (!isReverbConfigured()) return;
    return subscribeUserNotificationChannel(userId, () => {
      void refreshSilent();
    });
  }, [refreshSilent, userId]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      void fetchNotifications()
        .then(applyResult)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  };

  const handleItemClick = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        const updated = await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Navigation still proceeds.
      }
    }

    setOpen(false);

    if (notification.taskDate) {
      router.push(`/day/${notification.taskDate}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) =>
          item.readAt
            ? item
            : { ...item, readAt: new Date().toISOString() },
        ),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleToggle}
        className={`relative flex items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-800 ${
          compact ? "h-9 w-9" : "h-10 w-10"
        }`}
        aria-label={
          unreadCount > 0 ? `通知（未読${unreadCount}件）` : "通知"
        }
        aria-expanded={open}
      >
        <Bell className={compact ? "h-5 w-5" : "h-[1.35rem] w-[1.35rem]"} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_#fffdfb]">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`z-50 flex flex-col overflow-hidden rounded-2xl border border-[#eadfce]/90 bg-[#fffdfb] shadow-[0_10px_28px_rgba(120,90,50,0.1)] ${
            compact
              ? "fixed inset-x-3 top-[3.75rem] max-h-[min(28rem,72vh)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[23rem]"
              : "absolute right-0 mt-2 w-[23rem] max-w-[calc(100vw-1.5rem)]"
          }`}
          role="dialog"
          aria-label="通知"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce]/70 bg-[#fffcf8] px-4 py-3">
            <h2 className="text-sm font-bold tracking-wide text-slate-800">
              通知
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 hover:text-amber-900"
              >
                すべて既読
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-3">
            {loading && !hasLoaded ? (
              <p className="px-3 py-10 text-center text-sm text-stone-400">
                読み込み中...
              </p>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-400">
                  <Bell className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm text-stone-400">通知はありません</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {notifications.map((notification) => {
                  const unread = !notification.readAt;
                  const { Icon, iconWrap, iconColor } = notificationVisual(
                    notification.type,
                  );
                  const taskLabel = notification.message.trim();

                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => void handleItemClick(notification)}
                        className={`group flex w-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-all duration-150 sm:gap-3 sm:px-3.5 sm:py-3.5 ${
                          unread
                            ? "border-amber-200/70 bg-[#fff6eb] hover:border-amber-300/80 hover:bg-[#fff0df] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(245,158,11,0.1)]"
                            : "border-[#f0e6d8]/90 bg-white hover:border-amber-200/60 hover:bg-amber-50/50 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(120,90,50,0.06)]"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
                          aria-hidden
                        >
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </span>

                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span
                            className={`block break-words whitespace-normal text-[13px] leading-snug text-slate-800 sm:text-sm ${
                              unread ? "font-bold" : "font-semibold"
                            }`}
                          >
                            {notification.title}
                          </span>
                          {taskLabel ? (
                            <span className="mt-0.5 block break-words whitespace-normal text-[13px] leading-snug text-slate-600 sm:text-sm">
                              {taskLabel}
                            </span>
                          ) : null}
                          <span className="mt-1.5 block text-[11px] font-medium text-stone-400">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </span>

                        <span className="mt-1.5 flex w-3 shrink-0 justify-center" aria-hidden>
                          {unread ? (
                            <span className="h-2 w-2 rounded-full bg-orange-400" />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
