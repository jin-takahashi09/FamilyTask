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
import { SelectedMembersDisplay } from "@/components/MemberColorLabel";
import {
  homeHrefForSelection,
  parseSelectedUserIds,
} from "@/lib/member-selection";

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
  const usersParam = searchParams.get("users");
  const userId = searchParams.get("user");
  const mineOnly = searchParams.get("mine") === "1";
  const date = parseDateKey(dateKey);
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);

  const selectedUserIds = parseSelectedUserIds(
    usersParam,
    userId,
    currentUser?.id ?? "",
    isFamilyMember,
  );
  const isSelfIncluded = Boolean(
    currentUser && selectedUserIds.includes(currentUser.id),
  );
  const selectedUsers = selectedUserIds
    .map((id) => getUserById(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const user = selectedUsers[0];

  useEffect(() => {
    const invalid = selectedUserIds.find(
      (id) => id !== currentUser?.id && !isFamilyMember(id),
    );
    if (invalid) {
      router.replace("/");
    }
  }, [selectedUserIds, currentUser, isFamilyMember, router]);

  const tasks = getTasksByDate(dateKey).filter((task) => {
    if (selectedUserIds.length === 0) return false;
    if (mineOnly && userId) return task.assigneeId === userId;
    return selectedUserIds.some((id) =>
      id === currentUser?.id ? task.assigneeId === id : isTaskForUser(task, id),
    );
  });

  if (
    selectedUserIds.some((id) => id !== currentUser?.id && !isFamilyMember(id))
  ) {
    return null;
  }

  const backHref = currentUser
    ? homeHrefForSelection(selectedUserIds, currentUser.id)
    : "/";

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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl">
            {formatDayLabel(date)}
          </h2>
          {selectedUsers.length > 0 && (
            <SelectedMembersDisplay members={selectedUsers} prefix={null} />
          )}
        </div>
      </div>

      {isSelfIncluded && (
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
        showAddHint={isSelfIncluded}
        emptyMessage={
          selectedUsers.length > 1
            ? "選択中のメンバーに関係するタスクはまだありません"
            : user
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
      </div>
    </AuthGuard>
  );
}
