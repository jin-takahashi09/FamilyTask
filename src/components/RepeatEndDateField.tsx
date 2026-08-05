"use client";

import { useId } from "react";
import {
  getRepeatEndDaysInMonth,
  getRepeatEndMinDay,
  isRepeatEndMonthDaySelectable,
  type RepeatEndMonthDay,
} from "@/lib/recurrence-utils";

type RepeatEndDateFieldProps = {
  startDateKey: string;
  value: RepeatEndMonthDay | null;
  onChange: (value: RepeatEndMonthDay | null) => void;
  id?: string;
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function monthHasSelectableDay(startDateKey: string, month: number): boolean {
  const minDay = getRepeatEndMinDay(startDateKey, month);
  const maxDay = getRepeatEndDaysInMonth(month, startDateKey);
  return minDay <= maxDay;
}

export function RepeatEndDateField({
  startDateKey,
  value,
  onChange,
  id,
}: RepeatEndDateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const monthId = `${fieldId}-month`;
  const dayId = `${fieldId}-day`;

  const month = value?.month ?? null;
  const day = value?.day ?? null;
  const maxDay = month ? getRepeatEndDaysInMonth(month, startDateKey) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleMonthChange = (nextMonth: number | null) => {
    if (nextMonth === null) {
      onChange(null);
      return;
    }
    const nextMinDay = getRepeatEndMinDay(startDateKey, nextMonth);
    const nextMaxDay = getRepeatEndDaysInMonth(nextMonth, startDateKey);
    const nextDay = day
      ? Math.min(Math.max(day, nextMinDay), nextMaxDay)
      : nextMinDay;
    onChange({ month: nextMonth, day: nextDay });
  };

  const handleDayChange = (nextDay: number | null) => {
    if (nextDay === null || month === null) {
      onChange(null);
      return;
    }
    onChange({ month, day: nextDay });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={monthId} className="sr-only">
        終了月
      </label>
      <select
        id={monthId}
        value={month ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          handleMonthChange(raw ? Number(raw) : null);
        }}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      >
        <option value="">月</option>
        {MONTH_OPTIONS.map((m) => {
          const selectable = monthHasSelectableDay(startDateKey, m);
          return (
            <option key={m} value={m} disabled={!selectable}>
              {m}月
            </option>
          );
        })}
      </select>
      <label htmlFor={dayId} className="sr-only">
        終了日
      </label>
      <select
        id={dayId}
        value={day ?? ""}
        disabled={month === null}
        onChange={(e) => {
          const raw = e.target.value;
          handleDayChange(raw ? Number(raw) : null);
        }}
        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">日</option>
        {dayOptions.map((d) => {
          const selectable =
            month !== null &&
            isRepeatEndMonthDaySelectable(startDateKey, { month, day: d });
          return (
            <option key={d} value={d} disabled={!selectable}>
              {d}日
            </option>
          );
        })}
      </select>
    </div>
  );
}
