"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  canCurrentUserCreateTask,
  getRecurringDeleteTargetIds,
} from "@/lib/task-utils";
import { generateRecurringDates } from "@/lib/recurrence-utils";
import type {
  AddTaskResult,
  AppState,
  FamilyGroup,
  FamilyMembership,
  Task,
  TaskSortOrder,
  UserProfile,
} from "@/lib/types";
import type { ProfileFormData } from "@/components/ProfileForm";
import { DEFAULT_TASK_SORT_ORDER, normalizeTaskSortOrder } from "@/lib/task-sort-utils";
import { fetchAuthMe, type AuthMeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  fetchMyProfile,
  ProfileFetchError,
  ProfileNotFoundError,
  ProfileSaveError,
  saveMyProfile,
  type FirestoreProfile,
} from "@/lib/api/profile";
import {
  applySavedProfile,
  mergeFirestoreProfile,
  profileFormToApiPayload,
} from "@/lib/profile-utils";
import {
  getFirebaseAuthErrorMessage,
  validateRegistrationInput,
} from "@/lib/firebase/auth-errors";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";

type LoginResult =
  | { success: true; profileCompleted: boolean; hasFamily: boolean }
  | { success: false; error?: string };

type FamilyActionResult =
  | { success: true; redirectTo?: string }
  | { success: false; error: string };

type ProfileActionResult =
  | { success: true }
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
  profileLoadError: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  completeProfile: (
    userId: string,
    data: ProfileFormData,
  ) => Promise<ProfileActionResult>;
  updateProfile: (
    userId: string,
    data: ProfileFormData,
  ) => Promise<ProfileActionResult>;
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
  addTask: (
    task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">,
  ) => AddTaskResult;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteRecurringTasksFromDate: (options: {
    familyId: string;
    recurrenceGroupId: string;
    fromDate: string;
  }) => void;
  deleteRecurringTaskSeries: (options: {
    familyId: string;
    recurrenceGroupId: string;
  }) => void;
  taskSortOrder: TaskSortOrder;
  setTaskSortOrder: (order: TaskSortOrder) => void;
  getTasksByDate: (dateKey: string) => Task[];
  getUserById: (id: string | null) => UserProfile | undefined;
  getMembershipForUser: (userId: string) => FamilyMembership | undefined;
};

const AppContext = createContext<AppContextValue | null>(null);

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

function buildSessionFromVerified(
  prev: AppState,
  verified: AuthMeResponse,
  firestoreProfile: FirestoreProfile | null,
): { state: AppState; result: LoginResult } {
  const user = mergeFirestoreProfile(verified, firestoreProfile, prev.users);
  const nextUsers = [...prev.users];
  const existingIndex = nextUsers.findIndex((entry) => entry.id === user.id);

  if (existingIndex === -1) {
    nextUsers.push(user);
  } else {
    nextUsers[existingIndex] = user;
  }

  const userMemberships = getUserMemberships(prev.memberships, user.id);
  const activeFamilyId = resolveActiveFamilyId(
    user.id,
    prev.memberships,
    prev.session?.userId === user.id ? prev.session.activeFamilyId : null,
    prev.activeFamilyPreferences[user.id],
  );
  const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
  if (activeFamilyId) {
    activeFamilyPreferences[user.id] = activeFamilyId;
  }

  return {
    state: {
      ...prev,
      users: nextUsers,
      session: { userId: user.id, activeFamilyId },
      activeFamilyPreferences,
    },
    result: {
      success: true,
      profileCompleted: user.profileCompleted,
      hasFamily: userMemberships.length > 0,
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawSetState] = useState<AppState>(() =>
    typeof window !== "undefined"
      ? normalizeActiveFamily(loadState())
      : DEFAULT_STATE,
  );
  const clientReady = useIsClientReady();
  const [authInitialized, setAuthInitialized] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);
  const syncSessionPromiseRef = useRef<Promise<LoginResult> | null>(null);
  const firebaseConfigured = isFirebaseConfigured();
  const isReady =
    clientReady && (authInitialized || !firebaseConfigured);

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

  const syncSessionWithFirebase = useCallback(
    async (firebaseUser: FirebaseUser | null): Promise<LoginResult> => {
      if (syncSessionPromiseRef.current) {
        return syncSessionPromiseRef.current;
      }

      const syncPromise = (async (): Promise<LoginResult> => {
        if (!firebaseUser) {
          updateState((prev) => {
            const userId = prev.session?.userId;
            const activeFamilyId = prev.session?.activeFamilyId;
            const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
            if (userId && activeFamilyId) {
              activeFamilyPreferences[userId] = activeFamilyId;
            }
            sessionUserIdRef.current = null;
            return { ...prev, session: null, activeFamilyPreferences };
          });
          return { success: false };
        }

        try {
          const verified = await fetchAuthMe();
          let firestoreProfile: FirestoreProfile | null = null;
          let nextProfileLoadError: string | null = null;

          try {
            firestoreProfile = await fetchMyProfile();
          } catch (error) {
            if (error instanceof ProfileNotFoundError) {
              firestoreProfile = null;
            } else if (error instanceof ProfileFetchError) {
              nextProfileLoadError = error.message;
            } else {
              nextProfileLoadError = "プロフィールを取得できませんでした";
            }
          }

          let result: LoginResult = { success: false };
          updateState((prev) => {
            const built = buildSessionFromVerified(
              prev,
              verified,
              firestoreProfile,
            );
            result = built.result;
            sessionUserIdRef.current = verified.uid;
            return built.state;
          });
          setProfileLoadError(nextProfileLoadError);
          return result;
        } catch (error) {
          sessionUserIdRef.current = null;
          setProfileLoadError(null);
          await signOut(getFirebaseAuth());
          updateState((prev) => ({ ...prev, session: null }));
          if (error instanceof ApiError) {
            return {
              success: false,
              error: "サーバーとの認証に失敗しました",
            };
          }
          return {
            success: false,
            error: "サーバーとの認証に失敗しました",
          };
        }
      })();

      syncSessionPromiseRef.current = syncPromise;

      try {
        return await syncPromise;
      } finally {
        if (syncSessionPromiseRef.current === syncPromise) {
          syncSessionPromiseRef.current = null;
        }
      }
    },
    [updateState],
  );

  useEffect(() => {
    sessionUserIdRef.current = state.session?.userId ?? null;
  }, [state.session?.userId]);

  useEffect(() => {
    if (!clientReady || !firebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (user && sessionUserIdRef.current === user.uid) {
        setAuthInitialized(true);
        return;
      }
      await syncSessionWithFirebase(user);
      setAuthInitialized(true);
    });

    return unsubscribe;
  }, [clientReady, firebaseConfigured, syncSessionWithFirebase]);

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

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      if (!isFirebaseConfigured()) {
        return {
          success: false,
          error: "Firebase設定が未完了です。.env.localを確認してください",
        };
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { success: false, error: "メールアドレスを入力してください" };
      }

      try {
        await signInWithEmailAndPassword(
          getFirebaseAuth(),
          normalizedEmail,
          password,
        );
        return syncSessionWithFirebase(getFirebaseAuth().currentUser);
      } catch (error) {
        if (getFirebaseAuth().currentUser) {
          await signOut(getFirebaseAuth());
        }
        return { success: false, error: getFirebaseAuthErrorMessage(error) };
      }
    },
    [syncSessionWithFirebase],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      passwordConfirm: string,
    ): Promise<LoginResult> => {
      if (!isFirebaseConfigured()) {
        return {
          success: false,
          error: "Firebase設定が未完了です。.env.localを確認してください",
        };
      }

      const validationError = validateRegistrationInput(
        email,
        password,
        passwordConfirm,
      );
      if (validationError) {
        return { success: false, error: validationError };
      }

      const normalizedEmail = email.trim().toLowerCase();

      try {
        await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          normalizedEmail,
          password,
        );
        return syncSessionWithFirebase(getFirebaseAuth().currentUser);
      } catch (error) {
        if (getFirebaseAuth().currentUser) {
          await signOut(getFirebaseAuth());
        }
        return { success: false, error: getFirebaseAuthErrorMessage(error) };
      }
    },
    [syncSessionWithFirebase],
  );

  const logout = useCallback(async () => {
    setProfileLoadError(null);
    updateState((prev) => {
      const userId = prev.session?.userId;
      const activeFamilyId = prev.session?.activeFamilyId;
      const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
      if (userId && activeFamilyId) {
        activeFamilyPreferences[userId] = activeFamilyId;
      }
      return { ...prev, session: null, activeFamilyPreferences };
    });

    if (isFirebaseConfigured()) {
      await signOut(getFirebaseAuth());
    }
  }, [updateState]);

  const completeProfile = useCallback(
    async (
      userId: string,
      data: ProfileFormData,
    ): Promise<ProfileActionResult> => {
      try {
        const saved = await saveMyProfile(profileFormToApiPayload(data));
        updateState((prev) => ({
          ...prev,
          users: prev.users.map((user) =>
            user.id === userId
              ? applySavedProfile(user, data, saved, true)
              : user,
          ),
        }));
        setProfileLoadError(null);
        return { success: true };
      } catch (error) {
        if (error instanceof ProfileSaveError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "プロフィールを保存できませんでした" };
      }
    },
    [updateState],
  );

  const updateProfile = useCallback(
    async (
      userId: string,
      data: ProfileFormData,
    ): Promise<ProfileActionResult> => {
      try {
        const saved = await saveMyProfile(profileFormToApiPayload(data));
        updateState((prev) => ({
          ...prev,
          users: prev.users.map((user) =>
            user.id === userId
              ? applySavedProfile(user, data, saved, user.profileCompleted)
              : user,
          ),
        }));
        setProfileLoadError(null);
        return { success: true };
      } catch (error) {
        if (error instanceof ProfileSaveError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "プロフィールを保存できませんでした" };
      }
    },
    [updateState],
  );

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
    ): AddTaskResult => {
      if (!currentFamilyId || !currentUser) return { success: false };

      if (!canCurrentUserCreateTask(task, currentUser.id)) {
        return { success: false };
      }

      const dates = generateRecurringDates({
        startDate: task.date,
        repeatType: task.repeatType,
        repeatEndDate: task.repeatEndDate,
        repeatWeekday: task.repeatWeekday,
      });

      if (dates.length === 0) return { success: false };

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

      return {
        success: true,
        createdCount: newTasks.length,
        recurrenceGroupId,
      };
    },
    [currentFamilyId, currentUser, updateState],
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

  const deleteRecurringTasksFromDate = useCallback(
    ({
      familyId,
      recurrenceGroupId,
      fromDate,
    }: {
      familyId: string;
      recurrenceGroupId: string;
      fromDate: string;
    }) => {
      if (!currentFamilyId || currentFamilyId !== familyId) return;

      updateState((prev) => {
        const deleteIds = new Set(
          getRecurringDeleteTargetIds(prev.tasks, {
            familyId,
            recurrenceGroupId,
            mode: "fromDate",
            fromDate,
          }),
        );
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => !deleteIds.has(t.id)),
        };
      });
    },
    [currentFamilyId, updateState],
  );

  const deleteRecurringTaskSeries = useCallback(
    ({
      familyId,
      recurrenceGroupId,
    }: {
      familyId: string;
      recurrenceGroupId: string;
    }) => {
      if (!currentFamilyId || currentFamilyId !== familyId) return;

      updateState((prev) => {
        const deleteIds = new Set(
          getRecurringDeleteTargetIds(prev.tasks, {
            familyId,
            recurrenceGroupId,
            mode: "series",
          }),
        );
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => !deleteIds.has(t.id)),
        };
      });
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

  const taskSortOrder = useMemo((): TaskSortOrder => {
    const userId = state.session?.userId;
    if (!userId) return DEFAULT_TASK_SORT_ORDER;
    return normalizeTaskSortOrder(state.taskSortPreferences[userId]);
  }, [state.session?.userId, state.taskSortPreferences]);

  const setTaskSortOrder = useCallback(
    (order: TaskSortOrder) => {
      updateState((prev) => {
        const userId = prev.session?.userId;
        if (!userId) return prev;
        return {
          ...prev,
          taskSortPreferences: {
            ...prev.taskSortPreferences,
            [userId]: order,
          },
        };
      });
    },
    [updateState],
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
      profileLoadError,
      login,
      register,
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
      deleteRecurringTasksFromDate,
      deleteRecurringTaskSeries,
      taskSortOrder,
      setTaskSortOrder,
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
      profileLoadError,
      login,
      register,
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
      deleteRecurringTasksFromDate,
      deleteRecurringTaskSeries,
      taskSortOrder,
      setTaskSortOrder,
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
