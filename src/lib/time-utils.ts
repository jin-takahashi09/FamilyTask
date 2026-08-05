/** Parse "HH:mm" into hour/minute. Returns null if invalid or empty. */
export function parseDeadlineTime(
  value: string | null | undefined,
): { hour: number; minute: number } | null {
  if (!value?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatDeadlineTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Display label for list views (not the picker trigger). */
export function formatDeadlineTimeDisplay(
  value: string | null | undefined,
): string {
  const parsed = parseDeadlineTime(value);
  if (!parsed) return "指定なし";
  return formatDeadlineTime(parsed.hour, parsed.minute);
}

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

export const DEFAULT_DEADLINE_HOUR = 9;
export const DEFAULT_DEADLINE_MINUTE = 0;

export type DraftDeadlineParts = { hour: number; minute: number };

/** Initial wheel values when opening picker with no confirmed time. */
export function getDefaultDraftTime(): DraftDeadlineParts {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

/** Copy confirmed time into draft, or use default when unset. */
export function draftFromConfirmed(
  deadlineTime: string | null,
): DraftDeadlineParts {
  const parsed = parseDeadlineTime(deadlineTime);
  if (parsed) return parsed;
  return getDefaultDraftTime();
}

export function draftPartsToTime(parts: DraftDeadlineParts): string {
  return formatDeadlineTime(parts.hour, parts.minute);
}
