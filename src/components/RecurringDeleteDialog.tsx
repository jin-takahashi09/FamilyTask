"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type RecurringDeleteDialogProps = {
  open: boolean;
  onSelectSingle: () => void;
  onSelectFromDate: () => void;
  onSelectSeries: () => void;
  onCancel: () => void;
};

const OPTIONS = [
  {
    key: "single",
    label: "このタスクだけ削除",
    description: "選択中の日付だけ削除します",
  },
  {
    key: "fromDate",
    label: "この日以降を削除",
    description: "選択中の日付以降を削除します",
  },
  {
    key: "series",
    label: "すべて削除",
    description: "この繰り返し予定をすべて削除します",
  },
] as const;

export function RecurringDeleteDialog({
  open,
  onSelectSingle,
  onSelectFromDate,
  onSelectSeries,
  onCancel,
}: RecurringDeleteDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const handlers = {
    single: onSelectSingle,
    fromDate: onSelectFromDate,
    series: onSelectSeries,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-labelledby="recurring-delete-title"
        aria-describedby="recurring-delete-message"
        className="relative z-[101] w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-xl md:rounded-3xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
        <h2
          id="recurring-delete-title"
          className="mb-1 pr-8 text-lg font-extrabold text-slate-800 md:pr-0"
        >
          繰り返しタスクを削除
        </h2>
        <p
          id="recurring-delete-message"
          className="mb-4 text-sm leading-relaxed text-slate-600"
        >
          どの範囲を削除しますか？
        </p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={handlers[option.key]}
              className="rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-left transition-colors hover:bg-rose-50"
            >
              <span className="block text-sm font-extrabold text-rose-600">
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-slate-500">
                {option.description}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
