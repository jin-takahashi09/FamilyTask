"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check, X } from "lucide-react";
import {
  TASK_SORT_OPTIONS,
} from "@/lib/task-sort-utils";
import type { TaskSortOrder } from "@/lib/types";

type TaskSortMenuProps = {
  value: TaskSortOrder;
  onChange: (value: TaskSortOrder) => void;
  compact?: boolean;
};

export function TaskSortMenu({
  value,
  onChange,
  compact = false,
}: TaskSortMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        desktopMenuRef.current?.contains(target) ||
        mobileMenuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const handleSelect = (next: TaskSortOrder) => {
    onChange(next);
    setOpen(false);
  };

  const menuBody = (
    <div className="flex flex-col gap-1">
      {TASK_SORT_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
              selected
                ? "bg-amber-50 text-amber-900"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{option.label}</span>
            {selected && (
              <Check className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 transition-colors hover:border-amber-200 hover:bg-amber-50/50 hover:text-amber-800 ${
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <ArrowUpDown className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        並び替え
      </button>

      {open && (
        <>
          <div
            ref={desktopMenuRef}
            id={menuId}
            role="menu"
            aria-label="並び替え"
            className="absolute right-0 top-full z-[80] mt-2 hidden w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl md:block"
          >
            <p className="px-3 py-1.5 text-[11px] font-bold text-slate-400">
              並び替え
            </p>
            {menuBody}
          </div>

          <div className="fixed inset-0 z-[90] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="閉じる"
              onClick={() => setOpen(false)}
            />
            <div
              ref={mobileMenuRef}
              role="menu"
              aria-label="並び替え"
              className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-slate-800">
                  並び替え
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                  aria-label="閉じる"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {menuBody}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
