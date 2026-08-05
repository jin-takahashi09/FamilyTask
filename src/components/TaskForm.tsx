"use client";

import { useState, FormEvent } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { useApp } from "@/context/AppProvider";
import { getUserLabel } from "@/lib/user-utils";
import {
  getTaskKind,
  getTaskMemberIds,
  type TaskKind,
} from "@/lib/task-utils";
import type { Task } from "@/lib/types";
import { VoiceInputButton } from "./VoiceInputButton";

type TaskFormProps = {
  dateKey: string;
  task?: Task;
  defaultAssigneeId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
};

function resolveInitialKind(
  task: Task | undefined,
  currentUserId: string,
  defaultAssigneeId?: string,
): TaskKind {
  if (task) return getTaskKind(task, currentUserId);
  if (defaultAssigneeId && defaultAssigneeId !== currentUserId) {
    return "family";
  }
  return "personal";
}

export function TaskForm({
  dateKey,
  task,
  defaultAssigneeId,
  onCancel,
  onSaved,
}: TaskFormProps) {
  const { addTask, updateTask, currentUser, getOtherFamilyMembers } = useApp();
  const isEdit = Boolean(task);
  const [open, setOpen] = useState(isEdit);

  const currentUserId = currentUser?.id ?? "";
  const familyMembers = getOtherFamilyMembers();

  const [title, setTitle] = useState(task?.title ?? "");
  const [taskKind, setTaskKind] = useState<TaskKind>(() =>
    resolveInitialKind(task, currentUserId, defaultAssigneeId),
  );
  const [familyAssigneeId, setFamilyAssigneeId] = useState(() => {
    if (task && getTaskKind(task, currentUserId) === "family") {
      return task.assigneeId ?? "";
    }
    if (defaultAssigneeId && defaultAssigneeId !== currentUserId) {
      return defaultAssigneeId;
    }
    return familyMembers[0]?.id ?? "";
  });
  const [deadlineTime, setDeadlineTime] = useState(task?.deadlineTime ?? "");
  const [alarmEnabled, setAlarmEnabled] = useState(task?.alarmEnabled ?? true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(
    task?.notifyOnComplete ?? false,
  );

  const resolvedFamilyAssigneeId =
    familyAssigneeId || familyMembers[0]?.id || "";

  const handleKindChange = (kind: TaskKind) => {
    setTaskKind(kind);
    if (kind === "personal") {
      setFamilyAssigneeId("");
    } else if (!familyAssigneeId && familyMembers[0]) {
      setFamilyAssigneeId(familyMembers[0].id);
    }
  };

  const resetForm = () => {
    setTitle("");
    setTaskKind("personal");
    setFamilyAssigneeId("");
    setDeadlineTime("");
    setAlarmEnabled(true);
    setNotifyOnComplete(false);
  };

  const handleClose = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    resetForm();
    setOpen(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUserId) return;

    if (taskKind === "family" && !resolvedFamilyAssigneeId) return;

    const memberIds = getTaskMemberIds(
      taskKind,
      currentUserId,
      resolvedFamilyAssigneeId,
    );

    const payload = {
      date: dateKey,
      title: title.trim(),
      requesterId: memberIds.requesterId,
      assigneeId: memberIds.assigneeId,
      deadlineTime: deadlineTime || null,
      completed: task?.completed ?? false,
      alarmEnabled,
      notifyOnComplete: taskKind === "family" ? notifyOnComplete : false,
    };

    if (isEdit && task) {
      updateTask(task.id, payload);
      onSaved?.();
    } else {
      addTask(payload);
      resetForm();
      setOpen(false);
    }
  };

  if (!open && !isEdit) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3.5 text-base font-extrabold text-white shadow-md shadow-orange-200/80 transition-all hover:from-amber-500 hover:to-orange-500 active:scale-95"
      >
        <Plus className="h-5 w-5" />
        新規タスクの追加
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {isEdit ? "タスクを編集" : "新しいタスクを追加"}
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-700">
            タスクの種類
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { value: "personal", label: "自分のタスク" },
                { value: "family", label: "家族にお願いする" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleKindChange(value)}
                className={`rounded-2xl border px-4 py-3 text-sm font-extrabold transition-all ${
                  taskKind === value
                    ? "border-amber-400 bg-amber-50 text-amber-900 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">
            課題 (タスク内容) <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: シャツのアイロンがけ、牛乳を買う"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            <VoiceInputButton onResult={(text) => setTitle(text)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              実施日
            </label>
            <input
              type="date"
              value={dateKey}
              readOnly
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              締切時間
            </label>
            <input
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {taskKind === "family" && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
            <label className="mb-1 block text-xs font-bold text-amber-900">
              担当者 (お願いする相手)
            </label>
            {familyMembers.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-500">
                お願いできる家族メンバーがまだ登録されていません
              </p>
            ) : (
              <select
                value={resolvedFamilyAssigneeId}
                onChange={(e) => setFamilyAssigneeId(e.target.value)}
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold focus:border-amber-400 focus:outline-none"
                required
              >
                <option value="">選択してください</option>
                {familyMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {getUserLabel(u)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={alarmEnabled}
              onChange={(e) => setAlarmEnabled(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-300"
            />
            アラーム通知
          </label>
          {taskKind === "family" && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={notifyOnComplete}
                onChange={(e) => setNotifyOnComplete(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-300"
              />
              完了時に依頼者へ通知
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={
              taskKind === "family" &&
              (familyMembers.length === 0 || !resolvedFamilyAssigneeId)
            }
            className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-200 hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEdit ? "保存する" : "追加する"}
          </button>
        </div>
      </form>
    </div>
  );
}
