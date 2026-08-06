import { apiFetch, ApiError } from "@/lib/api/client";

export type FirestoreProfile = {
  uid: string;
  email: string;
  displayName: string;
  avatarType: "none" | "initials";
  avatarValue: string;
  createdAt: string;
  updatedAt: string;
};

type ProfileResponse = {
  profile: FirestoreProfile;
};

export class ProfileNotFoundError extends Error {
  constructor() {
    super("プロフィールが未設定です");
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileFetchError extends Error {
  constructor(message = "プロフィールを取得できませんでした") {
    super(message);
    this.name = "ProfileFetchError";
  }
}

export class ProfileSaveError extends Error {
  constructor(message = "プロフィールを保存できませんでした") {
    super(message);
    this.name = "ProfileSaveError";
  }
}

export async function fetchMyProfile(): Promise<FirestoreProfile> {
  try {
    const response = await apiFetch<ProfileResponse>("/api/profile", {
      auth: true,
    });
    return response.profile;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        throw new ProfileNotFoundError();
      }
      if (error.status === 401) {
        throw error;
      }
      throw new ProfileFetchError();
    }
    throw new ProfileFetchError();
  }
}

export type SaveProfilePayload = {
  displayName: string;
  avatarType: "none" | "initials";
  avatarValue: string;
};

export async function saveMyProfile(
  payload: SaveProfilePayload,
): Promise<FirestoreProfile> {
  try {
    const response = await apiFetch<ProfileResponse>("/api/profile", {
      method: "PUT",
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.profile;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 422) {
        throw new ProfileSaveError(error.message);
      }
      if (error.status === 401) {
        throw error;
      }
      throw new ProfileSaveError();
    }
    throw new ProfileSaveError();
  }
}
