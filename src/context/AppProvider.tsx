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
import { canCurrentUserCreateTask } from "@/lib/task-utils";
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
import {
  apiMemberToUserProfile,
  createFamily as apiCreateFamily,
  deleteFamily as apiDeleteFamily,
  FamilyActionError,
  FamilyFetchError,
  fetchFamilyMembers,
  fetchMyFamilies,
  joinFamilyByInviteCode as apiJoinFamily,
  leaveFamily as apiLeaveFamily,
  regenerateInviteCode as apiRegenerateInviteCode,
  removeFamilyMember as apiRemoveFamilyMember,
  transferFamilyOwnership as apiTransferOwnership,
  type ApiFamilyMember,
} from "@/lib/api/families";
import {
  createFamilyTasks,
  deleteFamilyRecurrence,
  deleteFamilyTask,
  fetchFamilyTasks,
  mapCreateTaskInput,
  mapUpdateTaskInput,
  toggleFamilyTaskCompleted,
  updateFamilyTask,
} from "@/lib/api/tasks";
import {
  buildRefetchDedupKey,
  getRefetchPlan,
  shouldSkipDuplicateRefetch,
} from "@/lib/realtime/familySyncHandler";
import {
  disconnectEcho,
  getRealtimeConnectionState,
  isReverbConfigured,
  subscribeFamilySyncChannel,
} from "@/lib/realtime/echo";
import type { FamilySyncPayload } from "@/lib/realtime/types";

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
  familiesLoading: boolean;
  tasksLoading: boolean;
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
  createFamily: (name: string) => Promise<FamilyActionResult>;
  joinFamilyByInviteCode: (inviteCode: string) => Promise<FamilyActionResult>;
  leaveFamily: () => Promise<FamilyActionResult>;
  removeFamilyMember: (userId: string) => Promise<FamilyActionResult>;
  transferOwnership: (targetUserId: string) => Promise<FamilyActionResult>;
  deleteFamily: (confirmName: string) => Promise<FamilyActionResult>;
  regenerateInviteCode: () => Promise<FamilyActionResult & { inviteCode?: string }>;
  isFamilyMember: (userId: string) => boolean;
  getOtherFamilyMembers: () => UserProfile[];
  addTask: (
    task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">,
  ) => Promise<AddTaskResult>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteRecurringTasksFromDate: (options: {
    familyId: string;
    recurrenceGroupId: string;
    fromDate: string;
  }) => Promise<void>;
  deleteRecurringTaskSeries: (options: {
    familyId: string;
    recurrenceGroupId: string;
  }) => Promise<void>;
  toggleTaskCompleted: (id: string, completed: boolean) => Promise<void>;
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
  if (!state.session?.userId || state.memberships.length === 0) return state;
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

function mergeMemberProfiles(
  prev: AppState,
  members: ApiFamilyMember[],
): AppState {
  const nextUsers = [...prev.users];

  for (const member of members) {
    const profile = apiMemberToUserProfile(member);
    const existingIndex = nextUsers.findIndex((user) => user.id === profile.id);

    if (existingIndex === -1) {
      nextUsers.push(profile);
      continue;
    }

    const existing = nextUsers[existingIndex];
    nextUsers[existingIndex] = {
      ...existing,
      displayName: profile.displayName || existing.displayName,
      email: profile.email || existing.email,
      profileCompleted: profile.profileCompleted || existing.profileCompleted,
      profileImage: existing.profileImage ?? profile.profileImage,
    };
  }

  return { ...prev, users: nextUsers };
}

function applyFamiliesData(
  prev: AppState,
  userId: string,
  families: FamilyGroup[],
  memberships: FamilyMembership[],
): AppState {
  const activeFamilyId = resolveActiveFamilyId(
    userId,
    memberships,
    prev.session?.userId === userId ? prev.session.activeFamilyId : null,
    prev.activeFamilyPreferences[userId],
  );

  return updateSessionFamily(
    { ...prev, families, memberships },
    userId,
    activeFamilyId,
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
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activeFamilyMembers, setActiveFamilyMembers] = useState<ApiFamilyMember[]>(
    [],
  );
  const sessionUserIdRef = useRef<string | null>(null);
  const activeFamilyIdRef = useRef<string | null>(null);
  const familiesSyncedUidRef = useRef<string | null>(null);
  const syncSessionPromiseRef = useRef<Promise<LoginResult> | null>(null);
  const membersFetchRef = useRef<{
    familyId: string;
    promise: Promise<void>;
  } | null>(null);
  const tasksFetchRef = useRef<{
    familyId: string;
    promise: Promise<void>;
  } | null>(null);
  const tasksFetchGenerationRef = useRef(0);

  const invalidateTasksFetch = useCallback(() => {
    tasksFetchGenerationRef.current += 1;
  }, []);
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
    if (!clientReady || typeof window === "undefined") return;

    const win = window as unknown as {
      __familyTaskGetQA?: () => {
        familiesLoading: boolean;
        isReady: boolean;
        authInitialized: boolean;
        tasksLoading: boolean;
        activeFamilyMemberCount: number;
        realtimeConnectionState: string;
      };
    };
    win.__familyTaskGetQA = () => ({
      familiesLoading,
      tasksLoading,
      isReady,
      authInitialized,
      activeFamilyMemberCount: activeFamilyMembers.length,
      realtimeConnectionState: getRealtimeConnectionState(),
    });
  }, [clientReady, familiesLoading, tasksLoading, isReady, authInitialized, activeFamilyMembers.length]);

  useEffect(() => {
    if (!isReady) return;
    saveState(state);

    if (typeof window !== "undefined") {
      (
        window as unknown as {
          __familyTaskGetState?: () => AppState;
        }
      ).__familyTaskGetState = () => state;
    }
  }, [state, isReady]);

  const refreshFamilyMembers = useCallback(
    async (familyId: string, options: { force?: boolean } = {}) => {
      if (
        !options.force &&
        membersFetchRef.current?.familyId === familyId
      ) {
        return membersFetchRef.current.promise;
      }

      const promise = (async () => {
        try {
          const members = await fetchFamilyMembers(familyId);
          updateState((prev) => mergeMemberProfiles(prev, members));
          setActiveFamilyMembers(members);
        } catch {
          // member list refresh failure is non-fatal
        }
      })();

      membersFetchRef.current = { familyId, promise };

      try {
        await promise;
      } finally {
        if (membersFetchRef.current?.familyId === familyId) {
          membersFetchRef.current = null;
        }
      }
    },
    [updateState],
  );

  const refreshTasks = useCallback(
    async (familyId: string, options: { force?: boolean } = {}) => {
      if (!options.force && tasksFetchRef.current?.familyId === familyId) {
        return tasksFetchRef.current.promise;
      }

      const promise = (async () => {
        const generation = ++tasksFetchGenerationRef.current;
        setTasksLoading(true);
        try {
          const tasks = await fetchFamilyTasks(familyId);
          updateState((prev) => {
            if (generation !== tasksFetchGenerationRef.current) {
              return prev;
            }
            if (prev.session?.activeFamilyId !== familyId) {
              return prev;
            }
            return { ...prev, tasks };
          });
        } catch {
          // task refresh failure is non-fatal
        } finally {
          setTasksLoading(false);
        }
      })();

      tasksFetchRef.current = { familyId, promise };

      try {
        await promise;
      } finally {
        if (tasksFetchRef.current?.familyId === familyId) {
          tasksFetchRef.current = null;
        }
      }
    },
    [updateState],
  );

  const refreshFamilies = useCallback(async () => {
    const userId = sessionUserIdRef.current;
    if (!userId) {
      return;
    }

    setFamiliesLoading(true);
    try {
      const familiesData = await fetchMyFamilies();
      updateState((prev) =>
        normalizeActiveFamily(
          applyFamiliesData(
            prev,
            userId,
            familiesData.families,
            familiesData.memberships,
          ),
        ),
      );
    } catch {
      // families refresh failure is non-fatal
    } finally {
      setFamiliesLoading(false);
    }
  }, [updateState]);

  const refreshCurrentProfile = useCallback(async () => {
    const userId = sessionUserIdRef.current;
    if (!userId) {
      return;
    }

    try {
      const profile = await fetchMyProfile();
      updateState((prev) => {
        const existing = prev.users.find((user) => user.id === userId);
        if (!existing) {
          return prev;
        }

        return {
          ...prev,
          users: prev.users.map((user) =>
            user.id === userId
              ? {
                  ...existing,
                  displayName: profile.displayName,
                  avatarType: profile.avatarType,
                  avatarValue: profile.avatarValue,
                  profileCompleted: true,
                }
              : user,
          ),
        };
      });
    } catch {
      // profile refresh failure is non-fatal
    }
  }, [updateState]);

  const handleFamilySyncEvent = useCallback(
    async (payload: FamilySyncPayload) => {
      if (!payload.familyId || !payload.eventType) {
        return;
      }

      const activeId = activeFamilyIdRef.current;
      if (payload.familyId !== activeId) {
        return;
      }

      const plan = getRefetchPlan(payload.eventType);
      const dedupKey = buildRefetchDedupKey(payload, plan);

      if (shouldSkipDuplicateRefetch(dedupKey)) {
        return;
      }

      if (plan.families || plan.resolveActiveFamily) {
        await refreshFamilies();
      }

      const targetFamilyId = activeFamilyIdRef.current ?? payload.familyId;

      if (plan.members && targetFamilyId) {
        await refreshFamilyMembers(targetFamilyId, { force: true });
      }

      if (plan.profile) {
        await refreshCurrentProfile();
      }

      if (plan.tasks && targetFamilyId) {
        await refreshTasks(targetFamilyId, { force: true });
      }
    },
    [refreshCurrentProfile, refreshFamilies, refreshFamilyMembers, refreshTasks],
  );

  const syncSessionWithFirebase = useCallback(
    async (firebaseUser: FirebaseUser | null): Promise<LoginResult> => {
      if (syncSessionPromiseRef.current) {
        return syncSessionPromiseRef.current;
      }

      const syncPromise = (async (): Promise<LoginResult> => {
        if (!firebaseUser) {
          setFamiliesLoading(false);
          familiesSyncedUidRef.current = null;
          updateState((prev) => {
            const userId = prev.session?.userId;
            const activeFamilyId = prev.session?.activeFamilyId;
            const activeFamilyPreferences = { ...prev.activeFamilyPreferences };
            if (userId && activeFamilyId) {
              activeFamilyPreferences[userId] = activeFamilyId;
            }
            sessionUserIdRef.current = null;
            tasksFetchRef.current = null;
            return {
              ...prev,
              session: null,
              tasks: [],
              activeFamilyPreferences,
            };
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

          try {
            setFamiliesLoading(true);
            const familiesData = await fetchMyFamilies();

            updateState((prev) =>
              applyFamiliesData(
                prev,
                verified.uid,
                familiesData.families,
                familiesData.memberships,
              ),
            );

            updateState((prev) => {
              const user = prev.users.find((entry) => entry.id === verified.uid);
              result = {
                success: true,
                profileCompleted: Boolean(user?.profileCompleted),
                hasFamily: familiesData.memberships.length > 0,
              };
              return prev;
            });
            familiesSyncedUidRef.current = verified.uid;
          } catch (error) {
            if (error instanceof FamilyFetchError) {
              setProfileLoadError((current) => current ?? error.message);
            } else if (error instanceof ApiError && error.status !== 401) {
              setProfileLoadError(
                (current) => current ?? "所属グループを取得できませんでした",
              );
            }
          } finally {
            setFamiliesLoading(false);
          }

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
    if (!clientReady || !firebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (user && familiesSyncedUidRef.current === user.uid) {
        setAuthInitialized(true);
        return;
      }
      await syncSessionWithFirebase(user);
      setAuthInitialized(true);
    });

    return unsubscribe;
  }, [clientReady, firebaseConfigured, syncSessionWithFirebase]);

  useEffect(() => {
    sessionUserIdRef.current = state.session?.userId ?? null;
  }, [state.session?.userId]);

  const activeFamilyId = state.session?.activeFamilyId ?? null;

  useEffect(() => {
    activeFamilyIdRef.current = activeFamilyId;
  }, [activeFamilyId]);

  useEffect(() => {
    if (
      !clientReady ||
      !isReady ||
      !isReverbConfigured() ||
      !state.session?.userId ||
      !activeFamilyId ||
      familiesLoading
    ) {
      return;
    }

    return subscribeFamilySyncChannel(activeFamilyId, (payload) => {
      void handleFamilySyncEvent(payload);
    });
  }, [
    activeFamilyId,
    clientReady,
    familiesLoading,
    handleFamilySyncEvent,
    isReady,
    state.session?.userId,
  ]);

  const currentUser = useMemo(() => {
    if (!state.session) return null;
    return state.users.find((u) => u.id === state.session?.userId) ?? null;
  }, [state.session, state.users]);

  useEffect(() => {
    if (!activeFamilyId || !isReady || familiesLoading) return;
    setActiveFamilyMembers([]);
    void refreshFamilyMembers(activeFamilyId);
  }, [activeFamilyId, isReady, familiesLoading, refreshFamilyMembers]);

  useEffect(() => {
    if (!activeFamilyId || !isReady || familiesLoading) return;
    updateState((prev) => ({ ...prev, tasks: [] }));
    void refreshTasks(activeFamilyId);
  }, [activeFamilyId, isReady, familiesLoading, refreshTasks, updateState]);

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

    const profiles = activeFamilyMembers
      .map(apiMemberToUserProfile)
      .filter((user) => user.profileCompleted);
    const memberMemberships: FamilyMembership[] = activeFamilyMembers.map(
      (member) => ({
        id: `${currentFamilyId}_${member.userId}`,
        familyId: currentFamilyId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
      }),
    );

    if (profiles.length > 0) {
      return sortMembersForDisplay(
        profiles,
        memberMemberships,
        currentFamilyId,
      );
    }

    return sortMembersForDisplay(
      getFamilyMembers(state.users, state.memberships, currentFamilyId),
      state.memberships,
      currentFamilyId,
    );
  }, [
    activeFamilyMembers,
    currentFamilyId,
    state.memberships,
    state.users,
  ]);

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
    disconnectEcho();
    setProfileLoadError(null);
    setActiveFamilyMembers([]);
    familiesSyncedUidRef.current = null;
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

    if (result.success) {
      void refreshFamilyMembers(familyId);
      void refreshTasks(familyId, { force: true });
    }

    return result;
  }, [refreshFamilyMembers, refreshTasks, updateState]);

  const createFamily = useCallback(
    async (name: string): Promise<FamilyActionResult> => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: "家族名を入力してください" };
      }

      const userId = state.session?.userId;
      if (!userId) {
        return { success: false, error: "ログインが必要です" };
      }

      try {
        const created = await apiCreateFamily(trimmed);
        const nextActiveId = created.family.id;

        updateState((prev) =>
          updateSessionFamily(
            {
              ...prev,
              families: [
                ...prev.families.filter((f) => f.id !== created.family.id),
                created.family,
              ],
              memberships: [
                ...prev.memberships.filter(
                  (m) => !(m.userId === userId && m.familyId === created.family.id),
                ),
                created.membership,
              ],
            },
            userId,
            nextActiveId,
          ),
        );

        await refreshFamilyMembers(created.family.id);
        await refreshTasks(created.family.id, { force: true });
        return { success: true };
      } catch (error) {
        if (error instanceof FamilyActionError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "グループを作成できませんでした" };
      }
    },
    [refreshFamilyMembers, refreshTasks, state.session?.userId, updateState],
  );

  const joinFamilyByInviteCode = useCallback(
    async (code: string): Promise<FamilyActionResult> => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        return { success: false, error: "招待コードを入力してください" };
      }

      const userId = state.session?.userId;
      if (!userId) {
        return { success: false, error: "ログインが必要です" };
      }

      try {
        const joined = await apiJoinFamily(normalized);

        updateState((prev) =>
          updateSessionFamily(
            {
              ...prev,
              families: [
                ...prev.families.filter((f) => f.id !== joined.family.id),
                joined.family,
              ],
              memberships: [
                ...prev.memberships.filter(
                  (m) => !(m.userId === userId && m.familyId === joined.family.id),
                ),
                joined.membership,
              ],
            },
            userId,
            joined.family.id,
          ),
        );

        await refreshFamilyMembers(joined.family.id);
        await refreshTasks(joined.family.id, { force: true });
        return { success: true };
      } catch (error) {
        if (error instanceof FamilyActionError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "グループへの参加に失敗しました" };
      }
    },
    [refreshFamilyMembers, refreshTasks, state.session?.userId, updateState],
  );

  const leaveFamily = useCallback(async (): Promise<FamilyActionResult> => {
    const userId = state.session?.userId;
    const familyId = state.session?.activeFamilyId;
    if (!userId || !familyId) {
      return { success: false, error: "操作できません" };
    }

    const membership = getMembershipInFamily(state.memberships, userId, familyId);
    if (!membership) {
      return { success: false, error: "このグループに所属していません" };
    }

    if (membership.role === "owner") {
      const otherMembers = state.memberships.filter(
        (m) => m.familyId === familyId && m.userId !== userId,
      );
      if (otherMembers.length > 0) {
        return {
          success: false,
          error:
            "オーナーは退出する前に、オーナー権限の移譲またはグループの削除を行ってください",
        };
      }
      return {
        success: false,
        error:
          "オーナーは退出する前に、グループの削除を行うか、他メンバーへオーナー権限を移譲してください",
      };
    }

    try {
      await apiLeaveFamily(familyId);

      const newMemberships = state.memberships.filter(
        (m) => !(m.userId === userId && m.familyId === familyId),
      );
      const remaining = getUserMemberships(newMemberships, userId);
      const newActiveId = remaining[0]?.familyId ?? null;

      updateState((prev) =>
        updateSessionFamily(
          {
            ...prev,
            memberships: prev.memberships.filter(
              (m) => !(m.userId === userId && m.familyId === familyId),
            ),
          },
          userId,
          newActiveId,
        ),
      );

      if (newActiveId) {
        await refreshFamilyMembers(newActiveId);
      }

      return {
        success: true,
        redirectTo: newActiveId ? "/" : "/family/setup",
      };
    } catch (error) {
      if (error instanceof FamilyActionError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "グループから退出できませんでした" };
    }
  }, [
    refreshFamilyMembers,
    state.memberships,
    state.session?.activeFamilyId,
    state.session?.userId,
    updateState,
  ]);

  const removeFamilyMember = useCallback(
    async (targetUserId: string): Promise<FamilyActionResult> => {
      const userId = state.session?.userId;
      const familyId = state.session?.activeFamilyId;
      if (!userId || !familyId) {
        return { success: false, error: "操作できません" };
      }

      const ownerMembership = getMembershipInFamily(
        state.memberships,
        userId,
        familyId,
      );
      if (!ownerMembership || ownerMembership.role !== "owner") {
        return { success: false, error: "オーナーのみ実行できます" };
      }

      if (targetUserId === userId) {
        return { success: false, error: "自分自身は削除できません" };
      }

      const targetIsMember = activeFamilyMembers.some(
        (member) => member.userId === targetUserId,
      );
      if (!targetIsMember) {
        return { success: false, error: "メンバーが見つかりません" };
      }

      try {
        await apiRemoveFamilyMember(familyId, targetUserId);
        setActiveFamilyMembers((prev) =>
          prev.filter((member) => member.userId !== targetUserId),
        );
        membersFetchRef.current = null;
        updateState((prev) => ({
          ...prev,
          memberships: prev.memberships.filter(
            (m) => !(m.userId === targetUserId && m.familyId === familyId),
          ),
        }));
        await refreshFamilyMembers(familyId, { force: true });
        return { success: true };
      } catch (error) {
        if (error instanceof FamilyActionError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "メンバーを削除できませんでした" };
      }
    },
    [
      activeFamilyMembers,
      refreshFamilyMembers,
      state.memberships,
      state.session?.activeFamilyId,
      state.session?.userId,
      updateState,
    ],
  );

  const transferOwnership = useCallback(
    async (targetUserId: string): Promise<FamilyActionResult> => {
      const userId = state.session?.userId;
      const familyId = state.session?.activeFamilyId;
      if (!userId || !familyId) {
        return { success: false, error: "操作できません" };
      }

      const ownerMembership = getMembershipInFamily(
        state.memberships,
        userId,
        familyId,
      );
      if (!ownerMembership || ownerMembership.role !== "owner") {
        return { success: false, error: "オーナーのみ実行できます" };
      }

      if (targetUserId === userId) {
        return { success: false, error: "自分自身には移譲できません" };
      }

      const targetMember = activeFamilyMembers.find(
        (member) => member.userId === targetUserId,
      );
      if (!targetMember || targetMember.role !== "member") {
        return { success: false, error: "メンバーが見つかりません" };
      }

      try {
        const updated = await apiTransferOwnership(familyId, targetUserId);
        updateState((prev) => ({
          ...prev,
          families: prev.families.map((f) =>
            f.id === familyId
              ? {
                  ...f,
                  ownerId: updated.ownerId,
                  inviteCode: updated.inviteCode,
                  updatedAt: updated.updatedAt,
                }
              : f,
          ),
          memberships: prev.memberships.map((m) => {
            if (m.familyId !== familyId) return m;
            if (m.userId === userId) return { ...m, role: "member" as const };
            if (m.userId === targetUserId) {
              return { ...m, role: "owner" as const };
            }
            return m;
          }),
        }));
        await refreshFamilyMembers(familyId, { force: true });
        return { success: true };
      } catch (error) {
        if (error instanceof FamilyActionError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "オーナー権限を移譲できませんでした" };
      }
    },
    [
      activeFamilyMembers,
      refreshFamilyMembers,
      state.memberships,
      state.session?.activeFamilyId,
      state.session?.userId,
      updateState,
    ],
  );

  const deleteFamily = useCallback(
    async (confirmName: string): Promise<FamilyActionResult> => {
      const userId = state.session?.userId;
      const familyId = state.session?.activeFamilyId;
      if (!userId || !familyId) {
        return { success: false, error: "操作できません" };
      }

      const family = state.families.find((f) => f.id === familyId);
      if (!family) {
        return { success: false, error: "グループが見つかりません" };
      }

      const ownerMembership = getMembershipInFamily(
        state.memberships,
        userId,
        familyId,
      );
      if (!ownerMembership || ownerMembership.role !== "owner") {
        return { success: false, error: "オーナーのみ削除できます" };
      }

      if (confirmName.trim() !== family.name) {
        return {
          success: false,
          error: "グループ名が一致しません。削除を中止しました",
        };
      }

      try {
        await apiDeleteFamily(familyId, confirmName.trim());

        const remaining = getUserMemberships(
          state.memberships.filter((m) => m.familyId !== familyId),
          userId,
        );
        const newActiveId = remaining[0]?.familyId ?? null;

        updateState((prev) =>
          updateSessionFamily(
            {
              ...prev,
              families: prev.families.filter((f) => f.id !== familyId),
              memberships: prev.memberships.filter((m) => m.familyId !== familyId),
              tasks: prev.tasks.filter((t) => t.familyId !== familyId),
            },
            userId,
            newActiveId,
          ),
        );

        if (newActiveId) {
          await refreshFamilyMembers(newActiveId);
        }

        return {
          success: true,
          redirectTo: newActiveId ? "/" : "/family/setup",
        };
      } catch (error) {
        if (error instanceof FamilyActionError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: "グループを削除できませんでした" };
      }
    },
    [
      refreshFamilyMembers,
      state.families,
      state.memberships,
      state.session?.activeFamilyId,
      state.session?.userId,
      updateState,
    ],
  );

  const regenerateInviteCode = useCallback(async (): Promise<
    FamilyActionResult & { inviteCode?: string }
  > => {
    const userId = state.session?.userId;
    const familyId = state.session?.activeFamilyId;
    if (!userId || !familyId) {
      return { success: false, error: "操作できません" };
    }

    const ownerMembership = getMembershipInFamily(
      state.memberships,
      userId,
      familyId,
    );
    if (!ownerMembership || ownerMembership.role !== "owner") {
      return { success: false, error: "オーナーのみ実行できます" };
    }

    try {
      const updated = await apiRegenerateInviteCode(familyId);
      updateState((prev) => ({
        ...prev,
        families: prev.families.map((f) =>
          f.id === familyId
            ? {
                ...f,
                inviteCode: updated.inviteCode,
                updatedAt: updated.updatedAt,
              }
            : f,
        ),
      }));
      return { success: true, inviteCode: updated.inviteCode };
    } catch (error) {
      if (error instanceof FamilyActionError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "招待コードを再発行できませんでした" };
    }
  }, [state.memberships, state.session?.activeFamilyId, state.session?.userId, updateState]);

  const isFamilyMemberFn = useCallback(
    (userId: string) => {
      if (!currentFamilyId) return false;
      return activeFamilyMembers.some((member) => member.userId === userId);
    },
    [activeFamilyMembers, currentFamilyId],
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
    async (
      task: Omit<Task, "id" | "createdAt" | "familyId" | "recurrenceGroupId">,
    ): Promise<AddTaskResult> => {
      if (!currentFamilyId || !currentUser) return { success: false };

      if (!canCurrentUserCreateTask(task, currentUser.id)) {
        return { success: false };
      }

      try {
        const created = await createFamilyTasks(
          currentFamilyId,
          mapCreateTaskInput(task),
        );

        updateState((prev) => ({
          ...prev,
          tasks: [
            ...prev.tasks.filter(
              (existing) =>
                !created.some(
                  (createdTask) => createdTask.id === existing.id,
                ),
            ),
            ...created,
          ],
        }));
        invalidateTasksFetch();

        const recurrenceGroupId = created[0]?.recurrenceGroupId ?? null;

        return {
          success: true,
          createdCount: created.length,
          recurrenceGroupId,
        };
      } catch {
        return { success: false };
      }
    },
    [currentFamilyId, currentUser, invalidateTasksFetch, updateState],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      if (!currentFamilyId) return;

      const previous = state.tasks.find(
        (task) => task.id === id && task.familyId === currentFamilyId,
      );
      if (!previous) return;

      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id && t.familyId === currentFamilyId ? { ...t, ...updates } : t,
        ),
      }));

      try {
        const updated = await updateFamilyTask(
          currentFamilyId,
          id,
          mapUpdateTaskInput(updates),
        );
        updateState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id && t.familyId === currentFamilyId ? updated : t,
          ),
        }));
        invalidateTasksFetch();
      } catch {
        updateState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id && t.familyId === currentFamilyId ? previous : t,
          ),
        }));
      }
    },
    [currentFamilyId, invalidateTasksFetch, state.tasks, updateState],
  );

  const toggleTaskCompleted = useCallback(
    async (id: string, completed: boolean) => {
      if (!currentFamilyId) return;

      const previous = state.tasks.find(
        (task) => task.id === id && task.familyId === currentFamilyId,
      );
      if (!previous) return;

      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id && t.familyId === currentFamilyId
            ? { ...t, completed }
            : t,
        ),
      }));

      try {
        const updated = await toggleFamilyTaskCompleted(
          currentFamilyId,
          id,
          completed,
        );
        updateState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id && t.familyId === currentFamilyId ? updated : t,
          ),
        }));
        invalidateTasksFetch();
      } catch {
        updateState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id && t.familyId === currentFamilyId ? previous : t,
          ),
        }));
      }
    },
    [currentFamilyId, invalidateTasksFetch, state.tasks, updateState],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!currentFamilyId) return;

      const previousTasks = state.tasks;
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter(
          (t) => !(t.id === id && t.familyId === currentFamilyId),
        ),
      }));

      try {
        await deleteFamilyTask(currentFamilyId, id);
        invalidateTasksFetch();
      } catch {
        updateState((prev) => ({ ...prev, tasks: previousTasks }));
      }
    },
    [currentFamilyId, invalidateTasksFetch, state.tasks, updateState],
  );

  const deleteRecurringTasksFromDate = useCallback(
    async ({
      familyId,
      recurrenceGroupId,
      fromDate,
    }: {
      familyId: string;
      recurrenceGroupId: string;
      fromDate: string;
    }) => {
      if (!currentFamilyId || currentFamilyId !== familyId) return;

      const previousTasks = state.tasks;
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter(
          (task) =>
            !(
              task.familyId === familyId &&
              task.recurrenceGroupId === recurrenceGroupId &&
              task.date >= fromDate
            ),
        ),
      }));

      try {
        await deleteFamilyRecurrence(familyId, recurrenceGroupId, {
          scope: "future",
          fromDate,
        });
        invalidateTasksFetch();
      } catch {
        updateState((prev) => ({ ...prev, tasks: previousTasks }));
      }
    },
    [currentFamilyId, invalidateTasksFetch, state.tasks, updateState],
  );

  const deleteRecurringTaskSeries = useCallback(
    async ({
      familyId,
      recurrenceGroupId,
    }: {
      familyId: string;
      recurrenceGroupId: string;
    }) => {
      if (!currentFamilyId || currentFamilyId !== familyId) return;

      const previousTasks = state.tasks;
      updateState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter(
          (task) =>
            !(
              task.familyId === familyId &&
              task.recurrenceGroupId === recurrenceGroupId
            ),
        ),
      }));

      try {
        await deleteFamilyRecurrence(familyId, recurrenceGroupId, {
          scope: "all",
        });
        invalidateTasksFetch();
      } catch {
        updateState((prev) => ({ ...prev, tasks: previousTasks }));
      }
    },
    [currentFamilyId, invalidateTasksFetch, state.tasks, updateState],
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
      familiesLoading,
      tasksLoading,
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
      toggleTaskCompleted,
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
      familiesLoading,
      tasksLoading,
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
      toggleTaskCompleted,
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
