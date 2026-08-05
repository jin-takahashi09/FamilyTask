"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, Clock, RotateCcw, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  draftFromConfirmed,
  draftPartsToTime,
  formatDeadlineTime,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  parseDeadlineTime,
  type DraftDeadlineParts,
} from "@/lib/time-utils";

type DeadlineTimeFieldProps = {
  /** Confirmed deadline time. Null when unset. */
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
};

type PickerBodyProps = {
  draftDeadlineTime: DraftDeadlineParts;
  setDraftDeadlineTime: React.Dispatch<React.SetStateAction<DraftDeadlineParts>>;
  variant: "mobile" | "desktop";
};

function TimeWheelColumn({
  values,
  selected,
  onSelect,
  label,
}: {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  label: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;

  const scrollToValue = useCallback(
    (value: number, smooth = false) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const index = values.indexOf(value);
      if (index < 0) return;
      scroller.scrollTo({
        top: index * itemHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [values],
  );

  useEffect(() => {
    scrollToValue(selected);
  }, [selected, scrollToValue]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const index = Math.round(scroller.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    if (values[clamped] !== selected) {
      onSelect(values[clamped]!);
    }
  };

  return (
    <div className="relative flex-1">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y border-amber-200 bg-amber-50/40"
        style={{ height: itemHeight }}
        aria-hidden
      />
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-48 overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: itemHeight * 2,
          paddingBottom: itemHeight * 2,
        }}
        aria-label={label}
      >
        {values.map((value) => {
          const active = value === selected;
          return (
            <button
              key={value}
              type="button"
              data-value={value}
              onClick={() => {
                onSelect(value);
                scrollToValue(value, true);
              }}
              className={`flex h-10 w-full snap-center items-center justify-center text-xl font-extrabold transition-colors ${
                active ? "text-amber-700" : "text-slate-300"
              }`}
              style={{ height: itemHeight }}
            >
              {String(value).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickerBody({
  draftDeadlineTime,
  setDraftDeadlineTime,
  variant,
}: PickerBodyProps) {
  if (variant === "mobile") {
    return (
      <div className="relative flex items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-3">
        <TimeWheelColumn
          label="時"
          values={HOUR_OPTIONS}
          selected={draftDeadlineTime.hour}
          onSelect={(hour) =>
            setDraftDeadlineTime((prev) => ({ ...prev, hour }))
          }
        />
        <span className="pb-1 text-2xl font-extrabold text-slate-400">:</span>
        <TimeWheelColumn
          label="分"
          values={MINUTE_OPTIONS}
          selected={draftDeadlineTime.minute}
          onSelect={(minute) =>
            setDraftDeadlineTime((prev) => ({ ...prev, minute }))
          }
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500">時</span>
        <select
          value={draftDeadlineTime.hour}
          onChange={(e) =>
            setDraftDeadlineTime((prev) => ({
              ...prev,
              hour: Number(e.target.value),
            }))
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        >
          {HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}
            </option>
          ))}
        </select>
      </label>
      <span className="mt-5 text-xl font-extrabold text-slate-400">:</span>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-500">分</span>
        <select
          value={draftDeadlineTime.minute}
          onChange={(e) =>
            setDraftDeadlineTime((prev) => ({
              ...prev,
              minute: Number(e.target.value),
            }))
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        >
          {MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>
              {String(minute).padStart(2, "0")}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onOutside();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [refs, enabled, onOutside]);
}

export function DeadlineTimeField({
  value: deadlineTime,
  onChange,
  id,
}: DeadlineTimeFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [draftDeadlineTime, setDraftDeadlineTime] = useState<DraftDeadlineParts>(
    () => draftFromConfirmed(deadlineTime),
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const mobilePickerRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0 });

  const parsedConfirmed = parseDeadlineTime(deadlineTime);
  const hasConfirmedTime = parsedConfirmed !== null;
  const confirmedDisplay = parsedConfirmed
    ? formatDeadlineTime(parsedConfirmed.hour, parsedConfirmed.minute)
    : null;

  const openPicker = () => {
    setDraftDeadlineTime(draftFromConfirmed(deadlineTime));
    setPickerOpen(true);
  };

  const closePicker = () => setPickerOpen(false);

  const handlePickerCancel = useCallback(() => {
    closePicker();
  }, []);

  const handlePickerComplete = () => {
    onChange(draftPartsToTime(draftDeadlineTime));
    closePicker();
  };

  const handleClearRequest = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setClearConfirmOpen(true);
  };

  const handleClearConfirm = () => {
    onChange(null);
    setClearConfirmOpen(false);
    closePicker();
  };

  const handleClearCancel = () => {
    setClearConfirmOpen(false);
  };

  useClickOutside(
    [triggerRef, popoverRef, mobilePickerRef],
    pickerOpen && !clearConfirmOpen,
    handlePickerCancel,
  );

  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 288;
    const top = rect.bottom + 8;
    const left = Math.max(
      16,
      Math.min(rect.left, window.innerWidth - width - 16),
    );
    setPopoverStyle({ top, left });
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || clearConfirmOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handlePickerCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pickerOpen, clearConfirmOpen, handlePickerCancel]);

  const resetAction = hasConfirmedTime ? (
    <button
      type="button"
      onClick={handleClearRequest}
      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
      aria-label="締切時間をリセット"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      リセット
    </button>
  ) : null;

  const pickerResetAction = hasConfirmedTime ? (
    <button
      type="button"
      onClick={() => setClearConfirmOpen(true)}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      締切時間をリセット
    </button>
  ) : null;

  return (
    <>
      <ConfirmDialog
        open={clearConfirmOpen}
        title="締切時間をリセットしますか？"
        message="このタスクの締切時間が設定されていない状態になります。"
        confirmLabel="リセットする"
        cancelLabel="キャンセル"
        dangerTextOnly
        onConfirm={handleClearConfirm}
        onCancel={handleClearCancel}
      />

      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          id={fieldId}
          type="button"
          onClick={openPicker}
          className="flex min-h-[42px] flex-1 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <span
            className={`text-xs font-bold ${
              hasConfirmedTime ? "text-slate-800" : "text-slate-500"
            }`}
          >
            {hasConfirmedTime ? confirmedDisplay : "時間を設定する"}
          </span>
          {hasConfirmedTime ? (
            <Clock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          ) : (
            <ChevronRight
              className="h-4 w-4 shrink-0 text-slate-400"
              aria-hidden
            />
          )}
        </button>
        {resetAction}
      </div>

      {pickerOpen && (
        <div
          ref={mobilePickerRef}
          className="fixed inset-0 z-[110] flex flex-col bg-slate-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-mobile-title`}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
            <button
              type="button"
              onClick={handlePickerCancel}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="戻る"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2
              id={`${fieldId}-mobile-title`}
              className="text-base font-extrabold text-slate-800"
            >
              締切時間
            </h2>
          </header>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <PickerBody
              draftDeadlineTime={draftDeadlineTime}
              setDraftDeadlineTime={setDraftDeadlineTime}
              variant="mobile"
            />
            {pickerResetAction}
          </div>

          <footer className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={handlePickerCancel}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handlePickerComplete}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-sm font-bold text-white shadow-md shadow-amber-200"
            >
              完了
            </button>
          </footer>
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-[100] hidden md:block" aria-hidden>
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-desktop-title`}
            className="absolute z-[110] w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            style={{ top: popoverStyle.top, left: popoverStyle.left }}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2
                id={`${fieldId}-desktop-title`}
                className="text-sm font-extrabold text-slate-800"
              >
                締切時間
              </h2>
              <button
                type="button"
                onClick={handlePickerCancel}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <PickerBody
              draftDeadlineTime={draftDeadlineTime}
              setDraftDeadlineTime={setDraftDeadlineTime}
              variant="desktop"
            />

            {pickerResetAction && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {pickerResetAction}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handlePickerCancel}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handlePickerComplete}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-2 text-xs font-bold text-white shadow-sm"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
