"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { TaskCreateUndoToast } from "@/components/TaskCreateUndoToast";
import { useApp } from "@/context/AppProvider";
import { formatDayLabel, parseDateKey } from "@/lib/date-utils";
import { isTaskForUser } from "@/lib/task-utils";
import { getUserLabel } from "@/lib/user-utils";

type DayPageProps = {
  params: Promise<{ date: string }>;
};

type UndoNotice = {
  count: number;
  recurrenceGroupId: string;
};

function DayPageContent({ dateKey }: { dateKey: string }) {
  const {
    getTasksByDate,
    getUserById,
    currentUser,
    isFamilyMember,
    activeFamilyId,
    deleteRecurringTaskSeries,
  } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user");
  const mineOnly = searchParams.get("mine") === "1";
  const date = parseDateKey(dateKey);
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);

  const user = userId ? getUserById(userId) : undefined;
  const viewedUserId = userId ?? currentUser?.id ?? "";
  const isOwnCalendar = viewedUserId === currentUser?.id;

  useEffect(() => {
    if (userId && userId !== currentUser?.id && user && !isFamilyMember(userId)) {
      router.replace("/");
    }
  }, [userId, user, currentUser, isFamilyMember, router]);

  const tasks = getTasksByDate(dateKey).filter((task) => {
    if (!userId) return true;
    if (mineOnly) return task.assigneeId === userId;
    return isTaskForUser(task, userId);
  });

  if (userId && userId !== currentUser?.id && user && !isFamilyMember(userId)) {
    return null;
  }

  const backHref = mineOnly || isOwnCalendar ? "/" : userId ? `/member/${userId}` : "/";

  return (
    <>
      <div className="flex items-center gap-3 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-600 shadow-xs transition-colors hover:bg-slate-200"
          title="カレンダーに戻る"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl">
            {formatDayLabel(date)}
          </h2>
          {user && (
            <>
              <span className="text-sm font-bold text-slate-300">·</span>
              <p className="truncate text-sm font-bold text-slate-600">
                {isOwnCalendar
                  ? "自分のカレンダー"
                  : `${getUserLabel(user)} のカレンダー`}
              </p>
            </>
          )}
        </div>
      </div>

      {isOwnCalendar && (
        <TaskForm
          dateKey={dateKey}
          defaultAssigneeId={mineOnly ? userId ?? undefined : undefined}
          onBulkCreated={(info) => setUndoNotice(info)}
        />
      )}

      <TaskList
        tasks={tasks}
        title="この日のタスク"
        showSort
        showAddHint={isOwnCalendar}
        emptyMessage={
          user
            ? mineOnly
              ? `${getUserLabel(user)} が担当するタスクはまだありません`
              : `${getUserLabel(user)} に関係するタスクはまだありません`
            : "この日のタスクはまだありません"
        }
      />

      {undoNotice && activeFamilyId && (
        <TaskCreateUndoToast
          count={undoNotice.count}
          onUndo={() => {
            deleteRecurringTaskSeries({
              familyId: activeFamilyId,
              recurrenceGroupId: undoNotice.recurrenceGroupId,
            });
            setUndoNotice(null);
          }}
          onDismiss={() => setUndoNotice(null)}
        />
      )}
    </>
  );
}

export default function DayPage({ params }: DayPageProps) {
  const { date: dateKey } = use(params);

  return (
    <AuthGuard requireProfile>
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 p-3 sm:p-6">
        <Suspense
          fallback={
            <div className="py-12 text-center text-sm font-bold text-amber-700">
              読み込み中...
            </div>
          }
        >
          <DayPageContent dateKey={dateKey} />
        </Suspense>

        <p className="text-center text-xs text-amber-700/60">
          データはこの端末のブラウザに保存されます（お試し版）
        </p>
      </div>
    </AuthGuard>
  );
}
