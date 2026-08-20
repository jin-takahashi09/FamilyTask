"use client";

import { useApp } from "@/context/AppProvider";
import { TaskList } from "@/components/TaskList";
import { formatDayLabel, parseDateKey, toDateKey } from "@/lib/date-utils";
import { isTaskForUser } from "@/lib/task-utils";

type SelectedDayTasksProps = {
  dateKey: string;
  userIds: string[];
};

/** スマホ・iPad縦：選択日のタスク一覧（既存 getTasksByDate + メンバーフィルタを利用） */
export function SelectedDayTasks({ dateKey, userIds }: SelectedDayTasksProps) {
  const { getTasksByDate, currentUser } = useApp();
  const todayKey = toDateKey(new Date());
  const isToday = dateKey === todayKey;
  const date = parseDateKey(dateKey);

  const tasks = getTasksByDate(dateKey).filter((task) => {
    if (userIds.length === 0) return false;
    return userIds.some((id) =>
      id === currentUser?.id ? task.assigneeId === id : isTaskForUser(task, id),
    );
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <section className="rounded-xl border border-[#eadfce]/80 bg-[#fffcf8]">
      <div className="shrink-0 border-b border-[#eadfce]/80 bg-[#fff5eb]/70 px-4 py-2.5">
        <p className="text-[10px] font-bold text-amber-700">
          {isToday ? "今日" : "選択中"}
        </p>
        <h2 className="mt-0.5 text-sm font-extrabold text-slate-800 md:text-base">
          {isToday
            ? `${date.getMonth() + 1}月${date.getDate()}日のタスク`
            : `${formatDayLabel(date)}のタスク`}
        </h2>
        {tasks.length > 0 && (
          <p className="mt-1 text-[11px] text-[#9a8b7a]">
            未完了 {pendingCount}件 / 完了 {completedCount}件
          </p>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
          <span className="text-base text-stone-400" aria-hidden>
            ✓
          </span>
          <p className="text-sm font-medium text-slate-500">
            {isToday ? "今日はタスクなし" : "この日のタスクはありません"}
          </p>
        </div>
      ) : (
        <div className="p-3 md:p-4">
          <TaskList
            tasks={tasks}
            embedded
            showSort
            showFilters={false}
            emptyMessage="この日のタスクはありません"
          />
        </div>
      )}
    </section>
  );
}
