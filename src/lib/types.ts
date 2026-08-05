export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  profileImage: string | null;
  profileCompleted: boolean;
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
};

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
};

/** @deprecated Legacy member type – kept only for migration reference */
export type LegacyMember = {
  id: string;
  name: string;
};
