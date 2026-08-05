import type {
  AppState,
  FamilyGroup,
  FamilyMembership,
  RepeatType,
  Task,
  TaskSortOrder,
  UserProfile,
} from "./types";
import { resolveActiveFamilyId, sanitizeMemberships } from "./family-utils";
import { parseDateKey } from "./date-utils";
import { getDay } from "date-fns";
import { normalizeTaskSortOrder } from "./task-sort-utils";

export const STORAGE_KEY = "family-task-app";

export const DEFAULT_STATE: AppState = {
  users: [],
  families: [],
  memberships: [],
  tasks: [],
  session: null,
  activeFamilyPreferences: {},
  taskSortPreferences: {},
};

type LegacyState = Partial<AppState> & {
  members?: unknown[];
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    memberId?: string;
  } | null;
  tasks?: Array<Partial<Task> & Record<string, unknown>>;
};

function migrateLegacyUser(
  legacy: NonNullable<LegacyState["currentUser"]>,
): UserProfile {
  return {
    id: legacy.id ?? crypto.randomUUID(),
    email: legacy.email ?? "",
    displayName: legacy.name ?? "",
    profileImage: null,
    profileCompleted: Boolean(legacy.name && legacy.name !== "ユーザー"),
  };
}

function migrateFamilies(raw: LegacyState): FamilyGroup[] {
  if (!Array.isArray(raw.families)) return [];
  return raw.families
    .filter((f) => f && typeof f.id === "string" && typeof f.name === "string")
    .map((f) => ({
      id: f.id,
      name: f.name,
      inviteCode: f.inviteCode ?? "",
      ownerId: f.ownerId ?? "",
      createdAt: f.createdAt ?? new Date().toISOString(),
    }))
    .filter((f) => f.inviteCode && f.ownerId);
}

function migrateMemberships(raw: LegacyState): FamilyMembership[] {
  if (!Array.isArray(raw.memberships)) return [];
  return raw.memberships
    .filter(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.familyId === "string" &&
        typeof m.userId === "string",
    )
    .map((m) => ({
      id: m.id,
      familyId: m.familyId,
      userId: m.userId,
      role: m.role === "owner" ? "owner" : "member",
      joinedAt: m.joinedAt ?? new Date().toISOString(),
    }));
}

function normalizeRepeatType(value: unknown): RepeatType {
  if (
    value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  return "none";
}

function normalizeRepeatWeekday(
  value: unknown,
  repeatType: RepeatType,
  date: string,
): number | null {
  if (repeatType !== "weekly") return null;
  if (typeof value === "number" && value >= 0 && value <= 6) {
    return value;
  }
  try {
    return getDay(parseDateKey(date));
  } catch {
    return 0;
  }
}

function migrateTasks(raw: LegacyState): Task[] {
  if (!Array.isArray(raw.tasks)) return [];
  return raw.tasks
    .filter((t) => t && typeof t.id === "string" && typeof t.date === "string")
    .map((t) => ({
      id: t.id as string,
      familyId: typeof t.familyId === "string" ? t.familyId : "",
      date: t.date as string,
      title: (t.title as string) ?? "",
      requesterId: (t.requesterId as string | null) ?? null,
      assigneeId: (t.assigneeId as string | null) ?? null,
      deadlineTime: (t.deadlineTime as string | null) ?? null,
      completed: Boolean(t.completed),
      alarmEnabled: t.alarmEnabled !== false,
      notifyOnComplete: Boolean(t.notifyOnComplete),
      createdAt: (t.createdAt as string) ?? new Date().toISOString(),
      repeatType: normalizeRepeatType(t.repeatType),
      repeatWeekday: normalizeRepeatWeekday(
        t.repeatWeekday,
        normalizeRepeatType(t.repeatType),
        t.date as string,
      ),
      repeatEndDate:
        typeof t.repeatEndDate === "string" ? t.repeatEndDate : null,
      recurrenceGroupId:
        typeof t.recurrenceGroupId === "string" ? t.recurrenceGroupId : null,
    }));
}

export function migrateState(raw: LegacyState): AppState {
  const users: UserProfile[] = Array.isArray(raw.users)
    ? raw.users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName ?? "",
        profileImage: u.profileImage ?? null,
        profileCompleted: Boolean(u.profileCompleted),
      }))
    : [];

  let session = raw.session ?? null;

  if (raw.currentUser && !users.some((u) => u.id === raw.currentUser?.id)) {
    const migrated = migrateLegacyUser(raw.currentUser);
    users.push(migrated);
    session = { userId: migrated.id, activeFamilyId: null };
  }

  if (raw.currentUser && !session) {
    const existing = users.find((u) => u.email === raw.currentUser?.email);
    if (existing) {
      session = { userId: existing.id, activeFamilyId: null };
    }
  }

  const families = migrateFamilies(raw);
  const memberships = sanitizeMemberships(
    migrateMemberships(raw),
    users,
    families,
  );

  const activeFamilyPreferences: Record<string, string> =
    raw.activeFamilyPreferences &&
    typeof raw.activeFamilyPreferences === "object" &&
    !Array.isArray(raw.activeFamilyPreferences)
      ? Object.fromEntries(
          Object.entries(raw.activeFamilyPreferences).filter(
            ([, v]) => typeof v === "string",
          ),
        )
      : {};

  if (session && typeof session.userId === "string") {
    const legacySession = session as {
      userId: string;
      activeFamilyId?: string | null;
    };
    const activeFamilyId = resolveActiveFamilyId(
      legacySession.userId,
      memberships,
      legacySession.activeFamilyId,
      activeFamilyPreferences[legacySession.userId],
    );
    session = { userId: legacySession.userId, activeFamilyId };
    if (activeFamilyId) {
      activeFamilyPreferences[legacySession.userId] = activeFamilyId;
    }
  }

  const taskSortPreferences: Record<string, TaskSortOrder> =
    raw.taskSortPreferences &&
    typeof raw.taskSortPreferences === "object" &&
    !Array.isArray(raw.taskSortPreferences)
      ? Object.fromEntries(
          Object.entries(raw.taskSortPreferences).map(([userId, order]) => [
            userId,
            normalizeTaskSortOrder(order),
          ]),
        )
      : {};

  return {
    users,
    families,
    memberships,
    tasks: migrateTasks(raw),
    session,
    activeFamilyPreferences,
    taskSortPreferences,
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return migrateState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
