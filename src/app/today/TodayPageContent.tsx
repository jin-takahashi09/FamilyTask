"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { TaskList } from "@/components/TaskList";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppProvider";
import { getTodayTodoTasks } from "@/lib/task-utils";
import { getUserLabel } from "@/lib/user-utils";

export default function TodayPageContent() {
  const { familyTasks, currentUser, getUserById } = useApp();
  const searchParams = useSearchParams();
  const userId = searchParams.get("user");

  const targetUser = userId ? getUserById(userId) : currentUser;
  const todayTasks = getTodayTodoTasks(familyTasks, {
    userId: userId ?? currentUser?.id,
    currentUser,
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 p-3 sm:p-6">
      <div className="flex items-center gap-4 rounded-3xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 font-bold text-slate-600 shadow-xs transition-colors hover:bg-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-amber-600">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>今日やるべきタスク</span>
          </div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
            {targetUser && (
              <>
                <UserAvatar user={targetUser} size="sm" />
                <span>{getUserLabel(targetUser)}</span>
              </>
            )}
          </h2>
        </div>
      </div>

      <TaskList
        tasks={todayTasks}
        title="今日のタスク"
        showSort
        emptyMessage="今日やるべきタスクはありません"
        showFilters={false}
      />
    </div>
  );
}
