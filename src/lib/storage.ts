import type {
  AppState,
  FamilyGroup,
  FamilyMembership,
  TaskSortOrder,
  UserProfile,
} from "./types";
import { resolveActiveFamilyId } from "./family-utils";
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
  tasks?: Array<Record<string, unknown>>;
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

  const families: FamilyGroup[] = Array.isArray(raw.families)
    ? raw.families.map((family) => ({
        id: family.id,
        name: family.name,
        inviteCode: family.inviteCode,
        ownerId: family.ownerId,
        createdAt: family.createdAt,
      }))
    : [];

  const memberships: FamilyMembership[] = Array.isArray(raw.memberships)
    ? raw.memberships.map((membership) => ({
        id: membership.id,
        familyId: membership.familyId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt,
      }))
    : [];

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
    let activeFamilyId: string | null = null;

    if (memberships.length > 0) {
      activeFamilyId = resolveActiveFamilyId(
        legacySession.userId,
        memberships,
        legacySession.activeFamilyId,
        activeFamilyPreferences[legacySession.userId],
      );
    } else {
      activeFamilyId = activeFamilyPreferences[legacySession.userId] ?? null;
    }

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
    tasks: [],
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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      tasks: [],
    }),
  );
}
