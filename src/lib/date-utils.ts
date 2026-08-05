import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ja } from "date-fns/locale";

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function formatMonthYear(date: Date): string {
  return format(date, "yyyy年 M月", { locale: ja });
}

export function formatDayLabel(date: Date): string {
  return format(date, "M月d日 (EEE)", { locale: ja });
}

export function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export { addMonths, subMonths, isSameDay, isSameMonth, isToday };

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
