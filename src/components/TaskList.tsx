"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock, ListChecks, Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppProvider";
import { TaskForm } from "@/components/TaskForm";
import { UserAvatar } from "@/components/UserAvatar";
import { getUserInitials, getUserLabel } from "@/lib/user-utils";
import { shouldShowMemberFlow } from "@/lib/task-utils";
import type { Task } from "@/lib/types";

type TaskListProps = {
  tasks: Task[];
  emptyMessage?: string;
  showFilters?: boolean;
  embedded?: boolean;
  title?: string;
};

const STATUS_FILTERS = ["すべて", "未完了", "完了済み"] as const;

import type { UserProfile } from "@/lib/types";

function MemberBadge({
  user,
  name,
  initials,
}: {
  user?: UserProfile;
  name: string;
  initials: string;
}) {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 shadow-xs">
      {user ? (
        <UserAvatar user={user} size="sm" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px]">
          {initials}
        </span>
      )}
      <span>{name}</span>
    </span>
  );
}

export function TaskList({
  tasks,
  emptyMessage = "この日に予定されているタスクはありません",
  showFilters = true,
  embedded = false,
  title = "タスク一覧",
}: TaskListProps) {
  const { updateTask, deleteTask, getUserById } = useApp();
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("未完了");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "未完了") return !t.completed;
    if (statusFilter === "完了済み") return t.completed;
    return true;
  });

  const handleComplete = (task: Task) => {
    updateTask(task.id, { completed: !task.completed });

    if (!task.completed && task.notifyOnComplete && task.requesterId) {
      const requester = getUserById(task.requesterId);
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("タスク完了", {
            body: `${task.title} が完了しました（${requester ? getUserLabel(requester) : "依頼者"}へ通知）`,
          });
        }
      }
    }
  };

  const getUserDisplay = (id: string | null) => {
    const user = getUserById(id);
    if (!user) return { name: "—", initials: "?" };
    return { user, name: getUserLabel(user), initials: getUserInitials(user) };
  };

  const renderMemberSection = (task: Task) => {
    if (!shouldShowMemberFlow(task)) {
      return (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 whitespace-nowrap font-bold text-amber-800/80">
            種別:
          </span>
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
            自分用
          </span>
        </div>
      );
    }

    const requester = getUserDisplay(task.requesterId);
    const assignee = getUserDisplay(task.assigneeId);

    return (
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <span className="shrink-0 whitespace-nowrap font-bold text-amber-800/80">
          メンバー:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 font-bold">
          <MemberBadge
            user={"user" in requester ? requester.user : undefined}
            name={requester.name}
            initials={requester.initials}
          />
          <ArrowRight className="h-2.5 w-2.5 shrink-0 text-amber-400" />
          <MemberBadge
            user={"user" in assignee ? assignee.user : undefined}
            name={assignee.name}
            initials={assignee.initials}
          />
        </div>
      </div>
    );
  };

  const listContent =
    filteredTasks.length === 0 ? (
      <div
        className={`flex flex-col items-center justify-center text-center ${
          embedded ? "py-8" : "flex-grow py-16"
        }`}
      >
        {!embedded && (
          <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-4xl shadow-inner">
            ✨
          </div>
        )}
        <p
          className={`font-extrabold text-slate-800 ${embedded ? "text-sm" : "text-lg"}`}
        >
          {emptyMessage}
        </p>
        {!embedded && (
          <p className="mt-1 text-xs text-slate-400">
            「新規タスクの追加」からタスクを作成できます
          </p>
        )}
      </div>
    ) : (
      <ul
        className={`custom-scrollbar flex flex-col gap-3.5 overflow-y-auto pr-1 ${
          embedded ? "max-h-80" : "max-h-[600px]"
        }`}
      >
        {filteredTasks.map((task) => {
          if (editingTaskId === task.id) {
            return (
              <li key={task.id}>
                <TaskForm
                  dateKey={task.date}
                  task={task}
                  onCancel={() => setEditingTaskId(null)}
                  onSaved={() => setEditingTaskId(null)}
                />
              </li>
            );
          }

          return (
            <li
              key={task.id}
              className={`task-card flex flex-col gap-3.5 rounded-2xl border bg-white p-4 sm:p-5 ${
                task.completed
                  ? "border-slate-200 bg-slate-50/50 opacity-75"
                  : "border-amber-100/90 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleComplete(task)}
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 transition-all ${
                      task.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-amber-300 bg-white hover:border-amber-500"
                    }`}
                    aria-label={task.completed ? "未完了に戻す" : "完了にする"}
                  >
                    {task.completed && (
                      <Check className="h-3.5 w-3.5 font-bold" />
                    )}
                  </button>
                  <h4
                    className={`text-base font-extrabold leading-snug sm:text-lg ${
                      task.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-800"
                    }`}
                  >
                    {task.title}
                  </h4>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditingTaskId(task.id)}
                    className="p-1.5 text-slate-300 transition-colors hover:text-amber-600"
                    aria-label="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-slate-300 transition-colors hover:text-rose-500"
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="-mx-4 -mb-4 flex flex-col gap-3 rounded-b-2xl border-t border-amber-50 bg-amber-50/20 p-3.5 text-xs sm:-mx-5 sm:-mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
                {renderMemberSection(task)}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 whitespace-nowrap font-bold text-amber-800/80">
                    締切時間:
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-2.5 py-1 font-bold text-orange-600 shadow-xs">
                    <Clock className="h-3 w-3" />
                    <span>{task.deadlineTime || "指定なし"}</span>
                  </span>
                  {task.alarmEnabled && task.deadlineTime && (
                    <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                      アラームON
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  if (embedded) {
    return listContent;
  }

  return (
    <div className="flex flex-grow flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <ListChecks className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-extrabold text-slate-800">{title}</h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-800">
            {filteredTasks.length}
          </span>
        </div>
        {showFilters && (
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100/80 p-1">
            {STATUS_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStatusFilter(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === cat
                    ? "bg-amber-100 text-amber-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {listContent}
    </div>
  );
}
