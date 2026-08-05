import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  getDate,
  getDay,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";
import type { RepeatType } from "./types";
import { parseDateKey, toDateKey } from "./date-utils";

export const DEFAULT_MAX_RECURRING_MONTHS = 12;

export const WEEKDAY_FULL_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

export type RepeatSelection = {
  repeatType: RepeatType;
  repeatWeekday: number | null;
};

export type RepeatOption =
  | { kind: "none" }
  | { kind: "daily" }
  | { kind: "weekly"; weekday: number }
  | { kind: "monthly" }
  | { kind: "yearly" };

export const REPEAT_DROPDOWN_OPTIONS: RepeatOption[] = [
  { kind: "none" },
  { kind: "daily" },
  ...WEEKDAY_FULL_LABELS.map((_, weekday) => ({
    kind: "weekly" as const,
    weekday,
  })),
];

/** @deprecated use REPEAT_DROPDOWN_OPTIONS */
export const REPEAT_PICKER_OPTIONS = REPEAT_DROPDOWN_OPTIONS;

export function getWeeklyRepeatLabel(weekday: number): string {
  return `毎${WEEKDAY_FULL_LABELS[weekday] ?? "日曜日"}`;
}

export type GenerateRecurringDatesInput = {
  startDate: string;
  repeatType: RepeatType;
  repeatEndDate: string | null;
  repeatWeekday?: number | null;
  maxMonths?: number;
};

export function selectionFromTask(
  repeatType: RepeatType,
  repeatWeekday: number | null,
): RepeatSelection {
  return { repeatType, repeatWeekday };
}

export function optionFromSelection(
  selection: RepeatSelection,
): RepeatOption {
  if (selection.repeatType === "none") return { kind: "none" };
  if (selection.repeatType === "daily") return { kind: "daily" };
  if (selection.repeatType === "monthly") return { kind: "monthly" };
  if (selection.repeatType === "yearly") return { kind: "yearly" };
  return {
    kind: "weekly",
    weekday: selection.repeatWeekday ?? 0,
  };
}

export function selectionFromOption(option: RepeatOption): RepeatSelection {
  if (option.kind === "none") {
    return { repeatType: "none", repeatWeekday: null };
  }
  if (option.kind === "daily") {
    return { repeatType: "daily", repeatWeekday: null };
  }
  if (option.kind === "monthly") {
    return { repeatType: "monthly", repeatWeekday: null };
  }
  if (option.kind === "yearly") {
    return { repeatType: "yearly", repeatWeekday: null };
  }
  return { repeatType: "weekly", repeatWeekday: option.weekday };
}

export function getRepeatOptionLabel(option: RepeatOption): string {
  if (option.kind === "none") return "繰り返しなし";
  if (option.kind === "daily") return "毎日";
  if (option.kind === "monthly") return "毎月";
  if (option.kind === "yearly") return "毎年";
  return getWeeklyRepeatLabel(option.weekday);
}

export function repeatSelectionToValue(selection: RepeatSelection): string {
  if (selection.repeatType === "none") return "none";
  if (selection.repeatType === "daily") return "daily";
  if (selection.repeatType === "weekly") {
    return `weekly:${selection.repeatWeekday ?? 0}`;
  }
  return "none";
}

export function valueToRepeatSelection(value: string): RepeatSelection {
  if (value === "none") {
    return { repeatType: "none", repeatWeekday: null };
  }
  if (value === "daily") {
    return { repeatType: "daily", repeatWeekday: null };
  }
  if (value.startsWith("weekly:")) {
    const weekday = Number(value.slice("weekly:".length));
    return {
      repeatType: "weekly",
      repeatWeekday:
        Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 0,
    };
  }
  return { repeatType: "none", repeatWeekday: null };
}

export function getRepeatSelectionLabel(selection: RepeatSelection): string {
  return getRepeatOptionLabel(optionFromSelection(selection));
}

export function isSameRepeatOption(a: RepeatOption, b: RepeatOption): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "weekly" && b.kind === "weekly") {
    return a.weekday === b.weekday;
  }
  return true;
}

export function getRepeatLabel(
  repeatType: RepeatType,
  repeatWeekday?: number | null,
): string | null {
  if (repeatType === "none") return null;
  if (repeatType === "daily") return "毎日";
  if (repeatType === "monthly") return "毎月";
  if (repeatType === "yearly") return "毎年";
  if (repeatType === "weekly") {
    const weekday = repeatWeekday ?? 0;
    return getWeeklyRepeatLabel(weekday);
  }
  return null;
}

export function validateRepeatEndDate(
  startDate: string,
  repeatEndDate: string | null,
): string | null {
  if (!repeatEndDate) return null;
  const start = startOfDay(parseDateKey(startDate));
  const end = startOfDay(parseDateKey(repeatEndDate));
  if (isBefore(end, start)) {
    return "終了日は開始日以降を選択してください";
  }
  return null;
}

export function getEffectiveEndDate(
  startDate: string,
  repeatEndDate: string | null,
  maxMonths = DEFAULT_MAX_RECURRING_MONTHS,
): string {
  const start = startOfDay(parseDateKey(startDate));
  const maxEnd = addMonths(start, maxMonths);

  if (!repeatEndDate) {
    return toDateKey(maxEnd);
  }

  const end = startOfDay(parseDateKey(repeatEndDate));
  if (isAfter(end, maxEnd)) {
    return toDateKey(maxEnd);
  }
  return repeatEndDate;
}

function startOfMonthSafe(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getFirstWeeklyOccurrence(start: Date, targetWeekday: number): Date {
  const startDay = getDay(start);
  const daysUntil = (targetWeekday - startDay + 7) % 7;
  return addDays(start, daysUntil);
}

function generateMonthlyDates(
  start: Date,
  end: Date,
  anchorDay: number,
): string[] {
  const dates: string[] = [];
  let cursor = startOfDay(startOfMonthSafe(start));

  while (!isAfter(cursor, end)) {
    const lastDay = getDate(endOfMonth(cursor));
    const day = Math.min(anchorDay, lastDay);
    const occurrence = startOfDay(
      new Date(cursor.getFullYear(), cursor.getMonth(), day),
    );

    if (!isBefore(occurrence, start) && !isAfter(occurrence, end)) {
      dates.push(toDateKey(occurrence));
    }

    cursor = addMonths(cursor, 1);
  }

  return dates;
}

function generateWeeklyDates(
  start: Date,
  end: Date,
  targetWeekday: number,
): string[] {
  const dates: string[] = [];
  let current = getFirstWeeklyOccurrence(start, targetWeekday);

  while (!isAfter(current, end)) {
    dates.push(toDateKey(current));
    current = addDays(current, 7);
  }

  return dates;
}

function generateYearlyDates(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let current = start;

  while (!isAfter(current, end)) {
    dates.push(toDateKey(current));
    current = addYears(current, 1);
  }

  return dates;
}

export function generateRecurringDates(
  input: GenerateRecurringDatesInput,
): string[] {
  const {
    startDate,
    repeatType,
    repeatEndDate,
    repeatWeekday = null,
    maxMonths = DEFAULT_MAX_RECURRING_MONTHS,
  } = input;

  if (repeatType === "none") {
    return [startDate];
  }

  const start = startOfDay(parseDateKey(startDate));
  const endDateKey = getEffectiveEndDate(startDate, repeatEndDate, maxMonths);
  const end = startOfDay(parseDateKey(endDateKey));

  if (isAfter(start, end)) {
    return [];
  }

  if (repeatType === "daily") {
    const dates: string[] = [];
    let current = start;
    while (!isAfter(current, end)) {
      dates.push(toDateKey(current));
      current = addDays(current, 1);
    }
    return dates;
  }

  if (repeatType === "weekly") {
    const weekday =
      repeatWeekday !== null && repeatWeekday >= 0 && repeatWeekday <= 6
        ? repeatWeekday
        : getDay(start);
    return generateWeeklyDates(start, end, weekday);
  }

  if (repeatType === "monthly") {
    return generateMonthlyDates(start, end, getDate(start));
  }

  if (repeatType === "yearly") {
    return generateYearlyDates(start, end);
  }

  return [startDate];
}
