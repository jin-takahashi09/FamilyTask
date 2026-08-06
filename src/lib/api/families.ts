import { getFirebaseAuth } from "@/lib/firebase/client";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { FamilyGroup, FamilyMembership, UserProfile } from "@/lib/types";

export type ApiFamily = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role?: "owner" | "member";
  joinedAt?: string;
};

export type ApiFamilyMember = {
  userId: string;
  displayName: string;
  email: string;
  profileImage: string | null;
  role: "owner" | "member";
  joinedAt: string;
};

type FamiliesResponse = {
  families: ApiFamily[];
};

type FamilyResponse = {
  family: ApiFamily;
};

type MembersResponse = {
  members: ApiFamilyMember[];
};

export class FamilyFetchError extends Error {
  constructor(message = "グループ情報を取得できませんでした") {
    super(message);
    this.name = "FamilyFetchError";
  }
}

export class FamilyActionError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "FamilyActionError";
    this.status = status;
  }
}

function mapApiError(error: unknown, fallback: string): never {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      throw error;
    }
    throw new FamilyActionError(error.message, error.status);
  }
  throw new FamilyFetchError(fallback);
}

export function apiFamilyToGroup(family: ApiFamily): FamilyGroup {
  return {
    id: family.id,
    name: family.name,
    inviteCode: family.inviteCode,
    ownerId: family.ownerId,
    createdAt: family.createdAt,
  };
}

export function apiFamilyToMembership(
  family: ApiFamily,
  userId: string,
): FamilyMembership {
  return {
    id: `${family.id}_${userId}`,
    familyId: family.id,
    userId,
    role: family.role ?? "member",
    joinedAt: family.joinedAt ?? family.createdAt,
  };
}

export function apiMemberToUserProfile(member: ApiFamilyMember): UserProfile {
  return {
    id: member.userId,
    email: member.email,
    displayName: member.displayName,
    profileImage: member.profileImage,
    profileCompleted: Boolean(member.displayName),
  };
}

export function mapFamiliesResponse(
  families: ApiFamily[],
  userId: string,
): { families: FamilyGroup[]; memberships: FamilyMembership[] } {
  return {
    families: families.map(apiFamilyToGroup),
    memberships: families.map((family) => apiFamilyToMembership(family, userId)),
  };
}

export async function fetchMyFamilies(): Promise<{
  families: FamilyGroup[];
  memberships: FamilyMembership[];
}> {
  try {
    const response = await apiFetch<FamiliesResponse>("/api/families", {
      auth: true,
    });
    const userId = getFirebaseAuth().currentUser?.uid;
    if (!userId) {
      throw new ApiError(401, "認証が必要です");
    }
    return mapFamiliesResponse(response.families, userId);
  } catch (error) {
    mapApiError(error, "所属グループを取得できませんでした");
  }
}

export async function createFamily(name: string): Promise<{
  family: FamilyGroup;
  membership: FamilyMembership;
}> {
  try {
    const response = await apiFetch<FamilyResponse>("/api/families", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ name }),
    });
    const userId = getFirebaseAuth().currentUser?.uid;
    if (!userId) {
      throw new ApiError(401, "認証が必要です");
    }
    return {
      family: apiFamilyToGroup(response.family),
      membership: apiFamilyToMembership(response.family, userId),
    };
  } catch (error) {
    mapApiError(error, "グループを作成できませんでした");
  }
}

export async function joinFamilyByInviteCode(inviteCode: string): Promise<{
  family: FamilyGroup;
  membership: FamilyMembership;
}> {
  try {
    const response = await apiFetch<FamilyResponse>("/api/families/join", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
    });
    const userId = getFirebaseAuth().currentUser?.uid;
    if (!userId) {
      throw new ApiError(401, "認証が必要です");
    }
    return {
      family: apiFamilyToGroup(response.family),
      membership: apiFamilyToMembership(response.family, userId),
    };
  } catch (error) {
    mapApiError(error, "グループへの参加に失敗しました");
  }
}

export async function fetchFamily(familyId: string): Promise<FamilyGroup & { role: "owner" | "member" }> {
  try {
    const response = await apiFetch<FamilyResponse>(`/api/families/${familyId}`, {
      auth: true,
    });
    return {
      ...apiFamilyToGroup(response.family),
      role: response.family.role ?? "member",
    };
  } catch (error) {
    mapApiError(error, "グループ情報を取得できませんでした");
  }
}

export async function fetchFamilyMembers(
  familyId: string,
): Promise<ApiFamilyMember[]> {
  try {
    const response = await apiFetch<MembersResponse>(
      `/api/families/${familyId}/members`,
      { auth: true },
    );
    return response.members;
  } catch (error) {
    mapApiError(error, "メンバー一覧を取得できませんでした");
  }
}

export async function leaveFamily(familyId: string): Promise<void> {
  try {
    await apiFetch(`/api/families/${familyId}/leave`, {
      method: "POST",
      auth: true,
    });
  } catch (error) {
    mapApiError(error, "グループから退出できませんでした");
  }
}

export async function removeFamilyMember(
  familyId: string,
  userId: string,
): Promise<void> {
  try {
    await apiFetch(`/api/families/${familyId}/members/${userId}`, {
      method: "DELETE",
      auth: true,
    });
  } catch (error) {
    mapApiError(error, "メンバーを削除できませんでした");
  }
}

export async function transferFamilyOwnership(
  familyId: string,
  targetUserId: string,
): Promise<ApiFamily> {
  try {
    const response = await apiFetch<FamilyResponse>(
      `/api/families/${familyId}/transfer-ownership`,
      {
        method: "POST",
        auth: true,
        body: JSON.stringify({ targetUserId }),
      },
    );
    return response.family;
  } catch (error) {
    mapApiError(error, "オーナー権限を移譲できませんでした");
  }
}

export async function deleteFamily(
  familyId: string,
  confirmName: string,
): Promise<void> {
  try {
    await apiFetch(`/api/families/${familyId}`, {
      method: "DELETE",
      auth: true,
      body: JSON.stringify({ confirmName }),
    });
  } catch (error) {
    mapApiError(error, "グループを削除できませんでした");
  }
}

export async function regenerateInviteCode(
  familyId: string,
): Promise<ApiFamily> {
  try {
    const response = await apiFetch<FamilyResponse>(
      `/api/families/${familyId}/invite-code/regenerate`,
      {
        method: "POST",
        auth: true,
      },
    );
    return response.family;
  } catch (error) {
    mapApiError(error, "招待コードを再発行できませんでした");
  }
}
