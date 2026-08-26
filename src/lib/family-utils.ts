import type {
  FamilyGroup,
  FamilyMembership,
  Task,
  UserProfile,
} from "./types";

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  let code = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS[bytes[i] % INVITE_CODE_CHARS.length];
  }
  return code;
}

export function generateUniqueInviteCode(families: FamilyGroup[]): string {
  const existing = new Set(families.map((f) => f.inviteCode.toUpperCase()));
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateInviteCode();
    if (!existing.has(code)) return code;
  }
  return generateInviteCode(8);
}

export function getUserMemberships(
  memberships: FamilyMembership[],
  userId: string,
): FamilyMembership[] {
  return memberships.filter((m) => m.userId === userId);
}

/** @deprecated Use getUserMemberships – returns first membership only */
export function getUserMembership(
  memberships: FamilyMembership[],
  userId: string,
): FamilyMembership | undefined {
  return getUserMemberships(memberships, userId)[0];
}

export function getMembershipInFamily(
  memberships: FamilyMembership[],
  userId: string,
  familyId: string,
): FamilyMembership | undefined {
  return memberships.find(
    (m) => m.userId === userId && m.familyId === familyId,
  );
}

export function resolveActiveFamilyId(
  userId: string,
  memberships: FamilyMembership[],
  sessionActiveId: string | null | undefined,
  savedPreference: string | null | undefined,
): string | null {
  const userMemberships = getUserMemberships(memberships, userId);
  if (userMemberships.length === 0) return null;

  const validIds = new Set(userMemberships.map((m) => m.familyId));

  if (sessionActiveId && validIds.has(sessionActiveId)) {
    return sessionActiveId;
  }
  if (savedPreference && validIds.has(savedPreference)) {
    return savedPreference;
  }
  return userMemberships[0].familyId;
}

export function getUserFamilies(
  families: FamilyGroup[],
  memberships: FamilyMembership[],
  userId: string,
): FamilyGroup[] {
  const familyIds = new Set(
    getUserMemberships(memberships, userId).map((m) => m.familyId),
  );
  return families.filter((f) => familyIds.has(f.id));
}

export function getFamilyMembers(
  users: UserProfile[],
  memberships: FamilyMembership[],
  familyId: string,
): UserProfile[] {
  const memberIds = new Set(
    memberships.filter((m) => m.familyId === familyId).map((m) => m.userId),
  );
  return users.filter((u) => memberIds.has(u.id) && u.profileCompleted);
}

/** Display order: owner first, others unchanged */
export function sortMembersForDisplay(
  members: UserProfile[],
  memberships: FamilyMembership[],
  familyId: string,
): UserProfile[] {
  const ownerId =
    memberships.find((m) => m.familyId === familyId && m.role === "owner")
      ?.userId ?? null;

  if (!ownerId) return members;

  const owner = members.find((m) => m.id === ownerId);
  if (!owner) return members;

  return [owner, ...members.filter((m) => m.id !== ownerId)];
}

export function getOtherFamilyMembers(
  users: UserProfile[],
  memberships: FamilyMembership[],
  familyId: string,
  currentUserId: string,
): UserProfile[] {
  return getFamilyMembers(users, memberships, familyId).filter(
    (u) => u.id !== currentUserId,
  );
}

export function isUserInFamily(
  memberships: FamilyMembership[],
  userId: string,
  familyId: string,
): boolean {
  return memberships.some(
    (m) => m.userId === userId && m.familyId === familyId,
  );
}

export function getFamilyTasks(tasks: Task[], familyId: string): Task[] {
  return tasks.filter((t) => t.familyId === familyId);
}

/** Assign current familyId to legacy tasks owned by the user */
export function attachOrphanTasksToFamily(
  tasks: Task[],
  userId: string,
  familyId: string,
): Task[] {
  return tasks.map((task) => {
    if (task.familyId) return task;
    if (task.assigneeId === userId || task.requesterId === userId) {
      return { ...task, familyId };
    }
    return task;
  });
}

export function sanitizeMemberships(
  memberships: FamilyMembership[],
  users: UserProfile[],
  families: FamilyGroup[],
): FamilyMembership[] {
  const userIds = new Set(users.map((u) => u.id));
  const familyIds = new Set(families.map((f) => f.id));
  return memberships.filter(
    (m) =>
      userIds.has(m.userId) &&
      familyIds.has(m.familyId) &&
      (m.role === "owner" || m.role === "member"),
  );
}

export function getPostLoginPath(
  user: UserProfile | null,
  memberships: FamilyMembership[],
): string {
  if (!user?.profileCompleted) return "/profile/setup";
  if (getUserMemberships(memberships, user.id).length === 0) {
    return "/family/setup";
  }
  return "/";
}

/** App header / page title from family group name */
export function getBoardTitle(familyName?: string | null): string {
  const name = familyName?.trim();
  if (name) return `${name}のタスクボード`;
  return "タスクボード";
}
