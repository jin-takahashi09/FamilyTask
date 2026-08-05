"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_STATE, loadState, saveState } from "@/lib/storage";
import {
  attachOrphanTasksToFamily,
  generateUniqueInviteCode,
  getFamilyMembers,
  getFamilyTasks,
  getMembershipInFamily,
  getOtherFamilyMembers,
  getUserFamilies,
  getUserMemberships,
  isUserInFamily,
  resolveActiveFamilyId,
  sortMembersForDisplay,
} from "@/lib/family-utils";
import { generateRecurringDates } from "@/lib/recurrence-utils";
import type {
  AppState,
  FamilyGroup,
  FamilyMembership,
  Task,
  UserProfile,
} from "@/lib/types";
import type { ProfileFormData } from "@/components/ProfileForm";

type LoginResult =
  | { success: true; profileCompleted: boolean; hasFamily: boolean }
  | { success: false };

type FamilyActionResult =
  | { success: true; redirectTo?: string }
  | { success: false; error: string };

type AppContextValue = {
  users: UserProfile[];
  families: FamilyGroup[];
  memberships: FamilyMembership[];
  tasks: Task[];
  familyTasks: Task[];
  userFamilies: FamilyGroup[];
  activeFamilyId: string | null;
  currentUser: UserProfile | null;
  currentFamily: FamilyGroup | null;
  currentMembership: FamilyMembership | null;
  familyMembers: UserProfile[];
  isAuthenticated: boolean;
  hasFamily: boolean;
  isReady: boolean;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  completeProfile: (userId: string, data: ProfileFormData) => void;
  updateProfile: (userId: string, data: ProfileFormData) => void;
  switchFamily: (familyId: string) => FamilyActionResult;
  createFamily: (name: string) => FamilyActionResult;
  joinFamilyByInviteCode: (inviteCode: string) => FamilyActionResult;
  leaveFamily: () => FamilyActionResult;
  removeFamilyMember: (userId: string) => FamilyActionResult;
  transferOwnership: (targetUserId: string) => FamilyActionResult;
  deleteFamily: (confirmName: string) => FamilyActionResult;
  regenerateInviteCode: () => FamilyActionResult & { inviteCode?: string };
  isFamilyMember: (userId: string) => boolean;
  getOtherFamilyMembers: () => UserProfile[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">) => boolean;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getTasksByDate: (dateKey: string) => Task[];
  getUserById: (id: string | null) => UserProfile | undefined;
  getMembershipForUser: (userId: string) => FamilyMembership | undefined;
};

const AppContext = createContext<AppContextValue | null>(null);

function applyProfileData(
  user: UserProfile,
  data: ProfileFormData,
  markCompleted: boolean,
): UserProfile {
  return {
    ...user,
    displayName: data.displayName,
    profileImage: data.profileImage,
    profileCompleted: markCompleted ? true : user.profileCompleted,
  };
}

function updateSessionFamily(
  prev: AppState,
  userId: string,
  activeFamilyId: string | null,
): AppState {
  const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
  if (activeFamilyId) {
    activeFamilyPreferences[userId] = activeFamilyId;
  } else {
    delete activeFamilyPreferences[userId];
  }
  return {
    ...prev,
    session: prev.session ? { userId, activeFamilyId } : prev.session,
    activeFamilyPreferences,
  };
}

function normalizeActiveFamily(state: AppState): AppState {
  if (!state.session?.userId) return state;
  const resolved = resolveActiveFamilyId(
    state.session.userId,
    state.memberships,
    state.session.activeFamilyId,
    state.activeFamilyPreferences[state.session.userId],
  );
  if (resolved === state.session.activeFamilyId) return state;
  return updateSessionFamily(state, state.session.userId, resolved);
}

function useIsClientReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawSetState] = useState<AppState>(() =>
    typeof window !== "undefined"
      ? normalizeActiveFamily(loadState())
      : DEFAULT_STATE,
  );
  const isReady = useIsClientReady();

  const updateState = useCallback(
    (updater: AppState | ((prev: AppState) => AppState)) => {
      rawSetState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: AppState) => AppState)(prev)
            : updater;
        return normalizeActiveFamily(next);
      });
    },
    [],
  );

  useEffect(() => {
    if (isReady) saveState(state);
  }, [state, isReady]);

  const currentUser = useMemo(() => {
    if (!state.session) return null;
    return state.users.find((u) => u.id === state.session?.userId) ?? null;
  }, [state.session, state.users]);

  const activeFamilyId = state.session?.activeFamilyId ?? null;

  const userFamilies = useMemo(() => {
    if (!currentUser) return [];
    return getUserFamilies(state.families, state.memberships, currentUser.id);
  }, [state.families, state.memberships, currentUser]);

  const currentMembership = useMemo(() => {
    if (!currentUser || !activeFamilyId) return null;
    return (
      getMembershipInFamily(
        state.memberships,
        currentUser.id,
        activeFamilyId,
      ) ?? null
    );
  }, [state.memberships, currentUser, activeFamilyId]);

  const currentFamily = useMemo(() => {
    if (!activeFamilyId) return null;
    return state.families.find((f) => f.id === activeFamilyId) ?? null;
  }, [state.families, activeFamilyId]);

  const currentFamilyId = currentFamily?.id ?? null;

  const familyMembers = useMemo(() => {
    if (!currentFamilyId) return [];
    const members = getFamilyMembers(
      state.users,
      state.memberships,
      currentFamilyId,
    );
    return sortMembersForDisplay(members, state.memberships, currentFamilyId);
  }, [state.users, state.memberships, currentFamilyId]);

  const familyTasks = useMemo(() => {
    if (!currentFamilyId) return [];
    return getFamilyTasks(state.tasks, currentFamilyId);
  }, [state.tasks, currentFamilyId]);

  const hasFamily = useMemo(() => {
    if (!currentUser) return false;
    return getUserMemberships(state.memberships, currentUser.id).length > 0;
  }, [state.memberships, currentUser]);

  const login = useCallback((email: string, password: string): LoginResult => {
    void password;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { success: false };

    let result: LoginResult = { success: false };

    updateState((prev) => {
      const nextUsers = [...prev.users];
      let user = nextUsers.find((u) => u.email === normalizedEmail);

      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          displayName: "",
          profileImage: null,
          profileCompleted: false,
        };
        nextUsers.push(user);
      }

      const userMemberships = getUserMemberships(prev.memberships, user.id);
      const activeFamilyId = resolveActiveFamilyId(
        user.id,
        prev.memberships,
        null,
        prev.activeFamilyPreferences[user.id],
      );
      const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
      if (activeFamilyId) {
        activeFamilyPreferences[user.id] = activeFamilyId;
      }

      result = {
        success: true,
        profileCompleted: user.profileCompleted,
        hasFamily: userMemberships.length > 0,
      };

      return {
        ...prev,
        users: nextUsers,
        session: { userId: user.id, activeFamilyId },
        activeFamilyPreferences,
      };
    });

    return result;
  }, [updateState]);

  const logout = useCallback(() => {
    updateState((prev) => {
      const userId = prev.session?.userId;
      const activeFamilyId = prev.session?.activeFamilyId;
      const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
      if (userId && activeFamilyId) {
        activeFamilyPreferences[userId] = activeFamilyId;
      }
      return { ...prev, session: null, activeFamilyPreferences };
    });
  }, [updateState]);

  const completeProfile = useCallback((userId: string, data: ProfileFormData) => {
    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? applyProfileData(u, data, true) : u,
      ),
    }));
  }, [updateState]);

  const updateProfile = useCallback((userId: string, data: ProfileFormData) => {
    updateState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? applyProfileData(u, data, u.profileCompleted) : u,
      ),
    }));
  }, [updateState]);

  const switchFamily = useCallback((familyId: string): FamilyActionResult => {
    let result: FamilyActionResult = { success: false, error: "不明なエラー" };

    updateState((prev) => {
      const userId = prev.session?.userId;
      if (!userId) {
        result = { success: false, error: "ログインが必要です" };
        return prev;
      }
      if (!isUserInFamily(prev.memberships, userId, familyId)) {
        result = { success: false, error: "このグループに所属していません" };
        return prev;
      }
      result = { success: true };
      return updateSessionFamily(prev, userId, familyId);
    });

    return result;
  }, [updateState]);

  const createFamily = useCallback(
    (name: string): FamilyActionResult => {
      const trimmed = name.trim();
      if (!trimmed) return { success: false, error: "家族名を入力してください" };

      let result: FamilyActionResult = { success: false, error: "不明なエラー" };

      updateState((prev) => {
        const userId = prev.session?.userId;
        if (!userId) {
          result = { success: false, error: "ログインが必要です" };
          return prev;
        }

        const familyId = crypto.randomUUID();
        const inviteCode = generateUniqueInviteCode(prev.families);
        const family: FamilyGroup = {
          id: familyId,
          name: trimmed,
          inviteCode,
          ownerId: userId,
          createdAt: new Date().toISOString(),
        };
        const membership: FamilyMembership = {
          id: crypto.randomUUID(),
          familyId,
          userId,
          role: "owner",
          joinedAt: new Date().toISOString(),
        };

        result = { success: true };

        return updateSessionFamily(
          {
            ...prev,
            families: [...prev.families, family],
            memberships: [...prev.memberships, membership],
            tasks: attachOrphanTasksToFamily(prev.tasks, userId, familyId),
          },
          userId,
          familyId,
        );
      });

      return result;
    },
    [updateState],
  );

  const joinFamilyByInviteCode = useCallback(
    (code: string): FamilyActionResult => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        return { success: false, error: "招待コードを入力してください" };
      }

      let result: FamilyActionResult = {
        success: false,
        error: "招待コードが正しくありません",
      };

      updateState((prev) => {
        const userId = prev.session?.userId;
        if (!userId) {
          result = { success: false, error: "ログインが必要です" };
          return prev;
        }

        const family = prev.families.find(
          (f) => f.inviteCode.toUpperCase() === normalized,
        );
        if (!family) {
          result = { success: false, error: "招待コードが正しくありません" };
          return prev;
        }

        const existing = getMembershipInFamily(
          prev.memberships,
          userId,
          family.id,
        );
        if (existing) {
          result = {
            success: false,
            error: "このグループには既に参加しています",
          };
          return prev;
        }

        const membership: FamilyMembership = {
          id: crypto.randomUUID(),
          familyId: family.id,
          userId,
          role: "member",
          joinedAt: new Date().toISOString(),
        };

        result = { success: true };

        return updateSessionFamily(
          {
            ...prev,
            memberships: [...prev.memberships, membership],
            tasks: attachOrphanTasksToFamily(prev.tasks, userId, family.id),
          },
          userId,
          family.id,
        );
      });

      return result;
    },
    [updateState],
  );

  const leaveFamily = useCallback((): FamilyActionResult => {
    let result: FamilyActionResult = { success: false, error: "不明なエラー" };

    updateState((prev) => {
      const userId = prev.session?.userId;
      const familyId = prev.session?.activeFamilyId;
      if (!userId || !familyId) {
        result = { success: false, error: "操作できません" };
        return prev;
      }

      const membership = getMembershipInFamily(prev.memberships, userId, familyId);
      if (!membership) {
        result = { success: false, error: "このグループに所属していません" };
        return prev;
      }

      if (membership.role === "owner") {
        const otherMembers = prev.memberships.filter(
          (m) => m.familyId === familyId && m.userId !== userId,
        );
        if (otherMembers.length > 0) {
          result = {
            success: false,
            error:
              "オーナーは退出する前に、オーナー権限の移譲またはグループの削除を行ってください",
          };
          return prev;
        }
        result = {
          success: false,
          error:
            "オーナーは退出する前に、グループの削除を行うか、他メンバーへオーナー権限を移譲してください",
        };
        return prev;
      }

      const newMemberships = prev.memberships.filter(
        (m) => !(m.userId === userId && m.familyId === familyId),
      );
      const remaining = getUserMemberships(newMemberships, userId);
      const newActiveId = remaining[0]?.familyId ?? null;

      result = {
        success: true,
        redirectTo: newActiveId ? "/" : "/family/setup",
      };

      return updateSessionFamily(
        { ...prev, memberships: newMemberships },
        userId,
        newActiveId,
      );
    });

    return result;
  }, [updateState]);

  const removeFamilyMember = useCallback(
    (targetUserId: string): FamilyActionResult => {
      let result: FamilyActionResult = { success: false, error: "不明なエラー" };

      updateState((prev) => {
        const userId = prev.session?.userId;
        const familyId = prev.session?.activeFamilyId;
        if (!userId || !familyId) {
          result = { success: false, error: "操作できません" };
          return prev;
        }

        const ownerMembership = getMembershipInFamily(
          prev.memberships,
          userId,
          familyId,
        );
        if (!ownerMembership || ownerMembership.role !== "owner") {
          result = { success: false, error: "オーナーのみ実行できます" };
          return prev;
        }

        if (targetUserId === userId) {
          result = { success: false, error: "自分自身は削除できません" };
          return prev;
        }

        if (!isUserInFamily(prev.memberships, targetUserId, familyId)) {
          result = { success: false, error: "メンバーが見つかりません" };
          return prev;
        }

        result = { success: true };

        return {
          ...prev,
          memberships: prev.memberships.filter(
            (m) => !(m.userId === targetUserId && m.familyId === familyId),
          ),
        };
      });

      return result;
    },
    [updateState],
  );

  const transferOwnership = useCallback(
    (targetUserId: string): FamilyActionResult => {
      let result: FamilyActionResult = { success: false, error: "不明なエラー" };

      updateState((prev) => {
        const userId = prev.session?.userId;
        const familyId = prev.session?.activeFamilyId;
        if (!userId || !familyId) {
          result = { success: false, error: "操作できません" };
          return prev;
        }

        const ownerMembership = getMembershipInFamily(
          prev.memberships,
          userId,
          familyId,
        );
        if (!ownerMembership || ownerMembership.role !== "owner") {
          result = { success: false, error: "オーナーのみ実行できます" };
          return prev;
        }

        if (targetUserId === userId) {
          result = { success: false, error: "自分自身には移譲できません" };
          return prev;
        }

        const targetMembership = getMembershipInFamily(
          prev.memberships,
          targetUserId,
          familyId,
        );
        if (!targetMembership) {
          result = { success: false, error: "メンバーが見つかりません" };
          return prev;
        }

        result = { success: true };

        return {
          ...prev,
          families: prev.families.map((f) =>
            f.id === familyId ? { ...f, ownerId: targetUserId } : f,
          ),
          memberships: prev.memberships.map((m) => {
            if (m.familyId !== familyId) return m;
            if (m.userId === userId) return { ...m, role: "member" as const };
            if (m.userId === targetUserId) {
              return { ...m, role: "owner" as const };
            }
            return m;
          }),
        };
      });

      return result;
    },
    [updateState],
  );

  const deleteFamily = useCallback(
    (confirmName: string): FamilyActionResult => {
      let result: FamilyActionResult = { success: false, error: "不明なエラー" };

      updateState((prev) => {
        const userId = prev.session?.userId;
        const familyId = prev.session?.activeFamilyId;
        if (!userId || !familyId) {
          result = { success: false, error: "操作できません" };
          return prev;
        }

        const family = prev.families.find((f) => f.id === familyId);
        if (!family) {
          result = { success: false, error: "グループが見つかりません" };
          return prev;
        }

        const ownerMembership = getMembershipInFamily(
          prev.memberships,
          userId,
          familyId,
        );
        if (!ownerMembership || ownerMembership.role !== "owner") {
          result = { success: false, error: "オーナーのみ削除できます" };
          return prev;
        }

        if (confirmName.trim() !== family.name) {
          result = {
            success: false,
            error: "グループ名が一致しません。削除を中止しました",
          };
          return prev;
        }

        const remaining = getUserMemberships(
          prev.memberships.filter((m) => m.familyId !== familyId),
          userId,
        );
        const newActiveId = remaining[0]?.familyId ?? null;

        result = {
          success: true,
          redirectTo: newActiveId ? "/" : "/family/setup",
        };

        return updateSessionFamily(
          {
            ...prev,
            families: prev.families.filter((f) => f.id !== familyId),
            memberships: prev.memberships.filter((m) => m.familyId !== familyId),
            tasks: prev.tasks.filter((t) => t.familyId !== familyId),
          },
          userId,
          newActiveId,
        );
      });

      return result;
    },
    [updateState],
  );

  const regenerateInviteCode = useCallback((): FamilyActionResult & {
    inviteCode?: string;
  } => {
    let result: FamilyActionResult & { inviteCode?: string } = {
      success: false,
      error: "不明なエラー",
    };

    updateState((prev) => {
      const userId = prev.session?.userId;
      const familyId = prev.session?.activeFamilyId;
      if (!userId || !familyId) {
        result = { success: false, error: "操作できません" };
        return prev;
      }

      const ownerMembership = getMembershipInFamily(
        prev.memberships,
        userId,
        familyId,
      );
      if (!ownerMembership || ownerMembership.role !== "owner") {
        result = { success: false, error: "オーナーのみ実行できます" };
        return prev;
      }

      const newCode = generateUniqueInviteCode(prev.families);
      result = { success: true, inviteCode: newCode };

      return {
        ...prev,
        families: prev.families.map((f) =>
          f.id === familyId ? { ...f, inviteCode: newCode } : f,
        ),
      };
    });

    return result;
  }, [updateState]);

  const isFamilyMemberFn = useCallback(
    (userId: string) => {
      if (!currentFamilyId) return false;
      return isUserInFamily(state.memberships, userId, currentFamilyId);
    },
    [state.memberships, currentFamilyId],
  );

  const getOtherFamilyMembersFn = useCallback(() => {
    if (!currentUser || !currentFamilyId) return [];
    return getOtherFamilyMembers(
      state.users,
      state.memberships,
      currentFamilyId,
      currentUser.id,
    );
  }, [state.users, state.memberships, currentFamilyId, currentUser]);

  const addTask = useCallback(
    (
      task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">,
    ): boolean => {
      if (!currentFamilyId) return false;

      const dates = generateRecurringDates({
        startDate: task.date,
        repeatType: task.repeatType,
        repeatEndDate: task.repeatEndDate,
        repeatWeekday: task.repeatWeekday,
      });

      if (dates.length === 0) return false;

      const recurrenceGroupId =
        task.repeatType === "none" ? null : crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const newTasks: Task[] = dates.map((date) => ({
        ...task,
        date,
        familyId: currentFamilyId,
        id: crypto.randomUUID(),
        recurrenceGroupId,
        createdAt,
        completed: false,
      }));

      updateState((prev) => ({
        ...prev,
        tasks: [...prev.tasks, ...newTasks],
      }));

      return true;
    },
    [currentFamilyId, updateState],
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      if (!currentFamilyId) return;

      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id && t.familyId === currentFamilyId
            ? { ...t, ...updates }
            : t,
        ),
      }));
    },
    [currentFamilyId, updateState],
  );

  const deleteTask = useCallback(
    (id: string) => {
      if (!currentFamilyId) return;

      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter(
          (t) => !(t.id === id && t.familyId === currentFamilyId),
        ),
      }));
    },
    [currentFamilyId, updateState],
  );

  const getTasksByDate = useCallback(
    (dateKey: string) => familyTasks.filter((t) => t.date === dateKey),
    [familyTasks],
  );

  const getUserById = useCallback(
    (id: string | null) =>
      id ? state.users.find((u) => u.id === id) : undefined,
    [state.users],
  );

  const getMembershipForUser = useCallback(
    (userId: string) => {
      if (!currentFamilyId) return undefined;
      return getMembershipInFamily(
        state.memberships,
        userId,
        currentFamilyId,
      );
    },
    [state.memberships, currentFamilyId],
  );

  const value = useMemo(
    () => ({
      users: state.users,
      families: state.families,
      memberships: state.memberships,
      tasks: state.tasks,
      familyTasks,
      userFamilies,
      activeFamilyId,
      currentUser,
      currentFamily,
      currentMembership,
      familyMembers,
      isAuthenticated: Boolean(state.session && currentUser),
      hasFamily,
      isReady,
      login,
      logout,
      completeProfile,
      updateProfile,
      switchFamily,
      createFamily,
      joinFamilyByInviteCode,
      leaveFamily,
      removeFamilyMember,
      transferOwnership,
      deleteFamily,
      regenerateInviteCode,
      isFamilyMember: isFamilyMemberFn,
      getOtherFamilyMembers: getOtherFamilyMembersFn,
      addTask,
      updateTask,
      deleteTask,
      getTasksByDate,
      getUserById,
      getMembershipForUser,
    }),
    [
      state,
      familyTasks,
      userFamilies,
      activeFamilyId,
      currentUser,
      currentFamily,
      currentMembership,
      familyMembers,
      hasFamily,
      isReady,
      login,
      logout,
      completeProfile,
      updateProfile,
      switchFamily,
      createFamily,
      joinFamilyByInviteCode,
      leaveFamily,
      removeFamilyMember,
      transferOwnership,
      deleteFamily,
      regenerateInviteCode,
      isFamilyMemberFn,
      getOtherFamilyMembersFn,
      addTask,
      updateTask,
      deleteTask,
      getTasksByDate,
      getUserById,
      getMembershipForUser,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
