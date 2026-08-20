"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/context/AppProvider";
import { TaskList } from "@/components/TaskList";
import { toDateKey } from "@/lib/date-utils";
import { isTaskForUser } from "@/lib/task-utils";
import type { Task } from "@/lib/types";

const STORAGE_PREFIX = "familyTask.todayTaskModalSeen";

function isCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function subscribeViewport(onStoreChange: () => void) {
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function storageKey(userId: string, familyId: string, dateKey: string): string {
  return `${STORAGE_PREFIX}:${userId}:${familyId}:${dateKey}`;
}

function readConfirmedIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeConfirmedIds(key: string, ids: string[]) {
  try {
    const unique = [...new Set(ids)].sort();
    localStorage.setItem(key, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

/** 古い使い方モーダル用キーを整理 */
function cleanupLegacyGuideKey() {
  try {
    localStorage.removeItem("familyTask.mobileCalendarGuideSeen");
  } catch {
    // ignore
  }
}

type TodayTasksModalProps = {
  userIds: string[];
};

export function TodayTasksModal({ userIds }: TodayTasksModalProps) {
  const { currentUser, activeFamilyId, getTasksByDate } = useApp();
  const [ackVersion, setAckVersion] = useState(0);

  const isCompact = useSyncExternalStore(
    subscribeViewport,
    isCompactViewport,
    () => false,
  );

  const todayKey = toDateKey(new Date());
  const today = new Date();

  const todayTasks = useMemo(() => {
    if (!currentUser || userIds.length === 0) return [] as Task[];
    return getTasksByDate(todayKey).filter((task) =>
      userIds.some((id) =>
        id === currentUser.id ? task.assigneeId === id : isTaskForUser(task, id),
      ),
    );
  }, [getTasksByDate, todayKey, userIds, currentUser]);

  const todayIds = useMemo(
    () => todayTasks.map((task) => task.id).sort(),
    [todayTasks],
  );

  const key =
    currentUser && activeFamilyId
      ? storageKey(currentUser.id, activeFamilyId, todayKey)
      : null;

  const confirmedIds = useMemo(() => {
    void ackVersion;
    if (!key || typeof window === "undefined") return [] as string[];
    cleanupLegacyGuideKey();
    return readConfirmedIds(key);
  }, [key, ackVersion]);

  const confirmedSet = useMemo(() => new Set(confirmedIds), [confirmedIds]);
  const hasUnconfirmed = todayIds.some((id) => !confirmedSet.has(id));
  const open =
    isCompact &&
    Boolean(key) &&
    todayIds.length > 0 &&
    hasUnconfirmed;

  const pendingCount = todayTasks.filter((t) => !t.completed).length;
  const completedCount = todayTasks.filter((t) => t.completed).length;

  const handleConfirm = useCallback(() => {
    if (!key) return;
    writeConfirmedIds(key, todayIds);
    setAckVersion((v) => v + 1);
  }, [key, todayIds]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="today-tasks-modal-title"
    >
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#eadfce]/90 bg-[#fffdfb] shadow-lg">
        <div className="shrink-0 border-b border-[#eadfce]/80 px-4 pb-3 pt-4">
          <h2
            id="today-tasks-modal-title"
            className="text-base font-extrabold text-slate-800"
          >
            今日のタスク
          </h2>
          <p className="mt-0.5 text-sm font-bold text-slate-600">
            {today.getMonth() + 1}月{today.getDate()}日
          </p>
          <p className="mt-1 text-xs text-[#9a8b7a]">
            未完了 {pendingCount}件 / 完了 {completedCount}件
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          <TaskList
            tasks={todayTasks}
            embedded
            showFilters={false}
            showSort={false}
            emptyMessage="今日はタスクなし"
          />
        </div>

        <div className="shrink-0 border-t border-[#eadfce]/80 p-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 active:bg-amber-600"
          >
            確認しました
          </button>
        </div>
      </div>
    </div>
  );
}
