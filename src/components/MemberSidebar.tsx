"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { getTodayTodoTasks } from "@/lib/task-utils";
import { getUserLabel } from "@/lib/user-utils";
import { TaskList } from "@/components/TaskList";

type MemberSidebarProps = {
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
};

export function MemberSidebar({
  selectedUserId,
  onSelectUser,
}: MemberSidebarProps) {
  const { familyTasks, currentUser, currentFamily, familyMembers } = useApp();

  if (!currentUser) return null;

  const members = familyMembers.length > 0 ? familyMembers : [currentUser];

  const getPendingCount = (userId: string) =>
    familyTasks.filter((t) => t.assigneeId === userId && !t.completed).length;

  return (
    <aside className="hidden md:block">
      <div className="flex flex-col gap-3 rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm lg:gap-4 lg:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
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

        <div className="flex flex-col gap-2 lg:gap-3">
          {members.map((user) => {
            const isSelf = user.id === currentUser.id;
            const isSelected = user.id === selectedUserId;

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectUser(user.id)}
                className={`flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all lg:gap-3 lg:p-3.5 ${
                  isSelected
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-100 bg-slate-50/70 hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                <UserAvatar user={user} size="md" />
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
                      <span className="text-[10px] font-bold text-amber-700 lg:text-xs">
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
    </aside>
  );
}

export function MyTodayTasks({
  userId,
  compactMobile = false,
}: {
  userId?: string;
  compactMobile?: boolean;
}) {
  const { familyTasks, currentUser } = useApp();
  const targetUserId = userId ?? currentUser?.id;
  const targetUser = userId ? undefined : (currentUser ?? undefined);

  const todayTasks = getTodayTodoTasks(familyTasks, {
    userId: targetUserId,
    currentUser: targetUser,
  });

  return (
    <section
      className={`overflow-hidden border border-amber-300/60 bg-white ${
        compactMobile
          ? "rounded-2xl shadow-sm"
          : "rounded-3xl shadow-md shadow-amber-200/50"
      }`}
    >
      <div
        className={`flex items-center justify-between bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 ${
          compactMobile ? "px-4 py-2.5" : "px-5 py-3.5 sm:px-6 sm:py-4"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={compactMobile ? "text-base" : "text-xl sm:text-2xl"}>
            ⭐
          </span>
          <h2
            className={`font-extrabold tracking-wide text-amber-900 ${
              compactMobile ? "text-sm" : "text-base sm:text-lg"
            }`}
          >
            今日のタスク
          </h2>
        </div>
        {todayTasks.length > 0 && (
          <span
            className={`rounded-full bg-rose-500 font-bold text-white ${
              compactMobile
                ? "px-2 py-0.5 text-[10px]"
                : "px-3 py-1 text-xs shadow-sm"
            }`}
          >
            {todayTasks.length} 件
          </span>
        )}
      </div>

      <div className={compactMobile ? "p-3" : "p-4 sm:p-5"}>
        <TaskList
          tasks={todayTasks}
          embedded
          showFilters={false}
          emptyMessage="今日やるべきタスクはありません"
        />
      </div>
    </section>
  );
}
