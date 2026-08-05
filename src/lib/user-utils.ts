import type { UserProfile } from "./types";

export function getUserInitials(user: Pick<UserProfile, "displayName">): string {
  const name = user.displayName.trim();
  if (!name) return "?";
  return name.slice(0, 1).toUpperCase();
}

export function getUserLabel(user: UserProfile): string {
  return user.displayName.trim() || "名前未設定";
}

/** Short label for compact mobile UI (max chars incl. ellipsis) */
export function getShortUserLabel(
  user: UserProfile,
  maxLen = 8,
  selfLabel = "自分",
): string {
  const full = getUserLabel(user);
  if (full === selfLabel || full.length <= maxLen) return full;
  if (maxLen <= 1) return "…";
  return `${full.slice(0, maxLen - 1)}…`;
}
