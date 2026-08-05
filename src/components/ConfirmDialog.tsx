"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative mx-auto w-full max-w-[min(100%,24rem)] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
        <h2
          id="confirm-dialog-title"
          className="mb-2 pr-8 text-lg font-extrabold text-slate-800"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className="mb-5 text-sm leading-relaxed text-slate-600"
        >
          {message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white ${
              danger
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type DeleteFamilyDialogProps = {
  open: boolean;
  familyName: string;
  onConfirm: (typedName: string) => void;
  onCancel: () => void;
};

function DeleteFamilyDialogForm({
  familyName,
  onConfirm,
  onCancel,
}: Omit<DeleteFamilyDialogProps, "open">) {
  const [typedName, setTypedName] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="閉じる"
        onClick={onCancel}
      />
      <div className="relative mx-auto w-full max-w-[min(100%,24rem)] rounded-3xl border border-rose-200 bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-lg font-extrabold text-rose-700">
          グループを削除
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          この操作は取り消せません。グループ内のタスクもすべて削除されます。
          <br />
          続行するには「<strong>{familyName}</strong>」と入力してください。
        </p>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={familyName}
          className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typedName)}
            disabled={typedName.trim() !== familyName}
            className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteFamilyDialog({
  open,
  familyName,
  onConfirm,
  onCancel,
}: DeleteFamilyDialogProps) {
  if (!open) return null;

  return (
    <DeleteFamilyDialogForm
      key={familyName}
      familyName={familyName}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
