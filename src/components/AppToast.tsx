"use client";

import { useEffect } from "react";

type AppToastProps = {
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  autoHideMs?: number;
};

export function AppToast({
  message,
  undoLabel = "取り消す",
  onUndo,
  onDismiss,
  autoHideMs = 5000,
}: AppToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, autoHideMs]);

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[90] flex w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-lg md:bottom-6 md:right-6 md:left-auto md:w-[min(100%,24rem)] md:translate-x-0"
    >
      <p className="text-sm font-bold text-slate-800">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        {onUndo && (
          <button
            type="button"
            onClick={() => {
              onUndo();
              onDismiss();
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-amber-700 hover:bg-amber-50"
          >
            {undoLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}
