export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  /** Local-only data URL fallback (legacy / same-device). */
  profileImage: string | null;
  /** Signed URL from API when avatar is stored in Firebase Storage. */
  avatarUrl: string | null;
  profileCompleted: boolean;
};

/** Member profile with role in the active family (from members API). */
export type FamilyMemberWithRole = UserProfile & {
  role: "owner" | "member";
};

export type FamilyGroup = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
};

export type FamilyMembership = {
  id: string;
  familyId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Task = {
  id: string;
  familyId: string;
  date: string;
  title: string;
  requesterId: string | null;
  assigneeId: string | null;
  deadlineTime: string | null;
  completed: boolean;
  alarmEnabled: boolean;
  notifyOnComplete: boolean;
  createdAt: string;
  repeatType: RepeatType;
  /** 0=日曜 … 6=土曜。weekly のときのみ使用 */
  repeatWeekday: number | null;
  repeatEndDate: string | null;
  recurrenceGroupId: string | null;
};

export type TaskSortOrder =
  | "deadlineAsc"
  | "createdDesc"
  | "createdAsc"
  | "titleAsc";

export type AddTaskResult =
  | { success: true; createdCount: number; recurrenceGroupId: string | null }
  | { success: false; error?: string };

export type Session = {
  userId: string;
  activeFamilyId: string | null;
};

export type AppState = {
  users: UserProfile[];
  families: FamilyGroup[];
  memberships: FamilyMembership[];
  tasks: Task[];
  session: Session | null;
  /** Persists last active family per user across logout/login */
  activeFamilyPreferences: Record<string, string>;
  /** Persists task list sort order per user */
  taskSortPreferences: Record<string, TaskSortOrder>;
};

/** @deprecated Legacy member type – kept only for migration reference */
export type LegacyMember = {
  id: string;
  name: string;
};
