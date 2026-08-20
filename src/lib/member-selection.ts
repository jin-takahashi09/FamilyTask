export function parseSelectedUserIds(
  rawUsers: string | null,
  rawUser: string | null,
  currentUserId: string,
  isAllowed: (userId: string) => boolean,
): string[] {
  if (rawUsers === "") {
    return currentUserId ? [currentUserId] : [];
  }

  const raw = rawUsers ?? rawUser;
  if (raw == null) {
    return currentUserId ? [currentUserId] : [];
  }

  const uniqueIds = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
  return uniqueIds.filter(
    (id) => id === currentUserId || isAllowed(id),
  );
}

export function toggleSelectedUserId(
  selected: string[],
  userId: string,
): string[] {
  if (selected.includes(userId)) {
    return selected.filter((id) => id !== userId);
  }
  return [...selected, userId];
}

export function serializeSelectedUserSearch(
  selected: string[],
  currentUserId: string,
): string {
  if (selected.length === 1 && selected[0] === currentUserId) {
    return "";
  }
  if (selected.length === 0) {
    return "users=";
  }
  return `users=${selected.map(encodeURIComponent).join(",")}`;
}

export function homeHrefForSelection(
  selected: string[],
  currentUserId: string,
): string {
  const query = serializeSelectedUserSearch(selected, currentUserId);
  return query ? `/?${query}` : "/";
}

export function dayHrefForSelection(
  dateKey: string,
  selected: string[],
  currentUserId: string,
): string {
  const query = serializeSelectedUserSearch(selected, currentUserId);
  return query ? `/day/${dateKey}?${query}` : `/day/${dateKey}`;
}
