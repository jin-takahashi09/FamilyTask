"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { getTodayTodoTasks } from "@/lib/task-utils";
import { toDateKey } from "@/lib/date-utils";
import { getUserLabel } from "@/lib/user-utils";
import { getMemberCalendarColor } from "@/lib/member-calendar-colors";
import { TaskList } from "@/components/TaskList";

type MemberSidebarProps = {
  selectedUserIds: string[];
  onSelectUser: (userId: string) => void;
  open: boolean;
  onToggle: () => void;
};

export function MemberSidebar({
  selectedUserIds,
  onSelectUser,
  open,
  onToggle,
}: MemberSidebarProps) {
  const { familyTasks, currentUser, currentFamily, familyMembers } = useApp();

  if (!currentUser) return null;

  const members = familyMembers.length > 0 ? familyMembers : [currentUser];

  const getPendingCount = (userId: string) =>
    familyTasks.filter((t) => t.assigneeId === userId && !t.completed).length;

  return (
    <aside className="flex min-h-0 min-w-0 flex-col">
      {!open ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label="メンバー一覧を表示"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-slate-500 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-3 shadow-sm lg:gap-3 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={true}
              aria-label="メンバー一覧を隠す"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-lg lg:text-xl">👨‍👩‍👧‍👦</span>
            <h3 className="truncate text-sm font-extrabold text-slate-800 lg:text-base">
              {currentFamily?.name ?? "グループ"}
            </h3>
          </div>
          <Link
            href="/family"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
          >
            <Settings2 className="h-3 w-3" />
            管理
          </Link>
        </div>

        <p className="text-[11px] font-bold text-slate-500 lg:text-xs">
          共有中のメンバー
        </p>
        <p className="text-[10px] leading-snug text-slate-400">
          クリックで表示 / もう一度で非表示。複数人を同時に表示できます
        </p>

        <div id="family-member-list" className="flex flex-col gap-2">
          {members.map((user) => {
            const isSelf = user.id === currentUser.id;
            const isSelected = selectedUserIds.includes(user.id);
            const color = getMemberCalendarColor(user.id);

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectUser(user.id)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-2 rounded-2xl border p-2 text-left transition-all lg:gap-2.5 lg:p-2.5 ${
                  isSelected
                    ? `${color.border}`
                    : "border-slate-100 bg-slate-50/70 hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                <div className={`rounded-full p-[2px] ${isSelected ? color.ring : "bg-slate-200/80"}`}>
                  <UserAvatar user={user} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-extrabold text-slate-800 lg:text-sm">
                      {getUserLabel(user)}
                    </span>
                    {isSelf && (
                      <span className="rounded-md border border-amber-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-amber-700 lg:text-[10px]">
                        自分
                      </span>
                    )}
                    {isSelected && (
                      <span className={`text-[10px] font-bold lg:text-xs ${color.text}`}>
                        表示中
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500 lg:text-xs">
                    担当:{" "}
                    <span className="font-bold text-slate-700">
                      {getPendingCount(user.id)} 件
                    </span>
                    の未完了
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {members.length <= 1 && (
          <p className="text-[10px] text-slate-400 lg:text-xs">
            招待コードを共有して、メンバーを追加できます
          </p>
        )}
      </div>
      )}
    </aside>
  );
}

export function MyTodayTasks({
  userId,
  userIds,
  compactMobile = false,
  fill = false,
  panel = false,
  board = false,
}: {
  userId?: string;
  userIds?: string[];
  compactMobile?: boolean;
  fill?: boolean;
  panel?: boolean;
  board?: boolean;
}) {
  const { familyTasks, currentUser } = useApp();
  const targetIds =
    userIds && userIds.length > 0
      ? userIds
      : [userId ?? currentUser?.id].filter((id): id is string => Boolean(id));

  const seen = new Set<string>();
  const todayTasks = targetIds.flatMap((id) =>
    getTodayTodoTasks(familyTasks, { userId: id }),
  ).filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });

  if (board) {
    const pendingCount = todayTasks.filter((task) => !task.completed).length;
    const todayKey = toDateKey(new Date());
    const completedSeen = new Set<string>();
    const completedCount = targetIds
      .flatMap((id) =>
        familyTasks.filter(
          (t) =>
            t.date === todayKey &&
            t.completed &&
            t.assigneeId === id,
        ),
      )
      .filter((task) => {
        if (completedSeen.has(task.id)) return false;
        completedSeen.add(task.id);
        return true;
      }).length;
    const today = new Date();

    return (
      <section className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="shrink-0 border-b border-stone-200/80 pb-3">
          <p className="text-xs font-bold text-amber-700">今日</p>
          <h2 className="mt-0.5 text-lg font-extrabold text-slate-800">
            {today.getMonth() + 1}月{today.getDate()}日
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            未完了 {pendingCount}件 / 完了 {completedCount}件
          </p>
        </div>

        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-3 pt-8 pb-4 text-center">
            <span className="text-base text-stone-400" aria-hidden>
              ✓
            </span>
            <p className="text-sm font-medium text-slate-500">今日はタスクなし</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col pt-3">
            <TaskList
              tasks={todayTasks}
              embedded
              fillList
              showSort
              showFilters={false}
              emptyMessage="今日やるべきタスクはありません"
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden bg-[#fffcf8] ${
        panel
          ? "flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-[#eadfce]/80"
          : compactMobile
            ? "rounded-xl border border-[#eadfce]/80"
            : "rounded-3xl border border-amber-300/60 shadow-md shadow-amber-200/50"
      } ${fill ? "flex h-full min-h-0 min-w-0 flex-col" : ""}`}
    >
      <div
        className={`flex shrink-0 items-center justify-between ${
          panel
            ? "border-b border-[#eadfce]/80 bg-[#fff5eb]/70 px-3 py-2.5"
            : compactMobile
              ? "border-b border-[#eadfce]/80 bg-[#fff5eb]/70 px-4 py-2.5"
              : fill
                ? "bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 px-4 py-2.5"
                : "bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 px-5 py-3.5 sm:px-6 sm:py-4"
        }`}
      >
        <div className="flex items-center gap-2">
          {(panel || compactMobile) ? null : (
            <span className="text-xl sm:text-2xl">⭐</span>
          )}
          <div>
            {(panel || compactMobile) && (
              <p className="text-[10px] font-bold text-amber-700">今日</p>
            )}
            <h2
              className={`font-extrabold tracking-wide ${
                panel || compactMobile
                  ? "text-sm text-slate-800"
                  : "text-base text-amber-900 sm:text-lg"
              }`}
            >
              今日のタスク
            </h2>
          </div>
        </div>
        {todayTasks.length > 0 && (
          <span
            className={`rounded-full font-bold ${
              panel || compactMobile
                ? "bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800"
                : "bg-rose-500 px-3 py-1 text-xs text-white shadow-sm"
            }`}
          >
            {todayTasks.length} 件
          </span>
        )}
      </div>

      <div
        className={`${panel ? "p-2.5" : compactMobile ? "p-3 md:p-4" : "p-3 sm:p-4"} ${fill ? "min-h-0 flex-1 overflow-y-auto custom-scrollbar" : ""}`}
      >
        <TaskList
          tasks={todayTasks}
          embedded
          showSort
          showFilters={false}
          emptyMessage="今日やるべきタスクはありません"
        />
      </div>
    </section>
  );
}
