import { getFirebaseAuth } from "@/lib/firebase/client";
import { apiFetch, ApiError } from "@/lib/api/client";
import { getEchoSocketId } from "@/lib/realtime/echo";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_TIMEOUT_MS = 30_000;

export type FirestoreProfile = {
  uid: string;
  email: string;
  displayName: string;
  avatarType: "none" | "initials" | "image";
  avatarValue: string;
  avatarUrl?: string | null;
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

export class ProfileAvatarError extends Error {
  constructor(message = "プロフィール画像を保存できませんでした") {
    super(message);
    this.name = "ProfileAvatarError";
  }
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

async function profileApiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set("Accept", "application/json");

  if (auth) {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new ApiError(401, "認証が必要です");
    }
    const token = await currentUser.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);

    const socketId = getEchoSocketId();
    if (socketId) {
      headers.set("X-Socket-Id", socketId);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(0, "サーバーとの通信がタイムアウトしました");
    }
    throw new ApiError(0, "サーバーとの通信に失敗しました");
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; errors?: Record<string, string[]> }
    | null;

  if (response.status === 401) {
    throw new ApiError(401, payload?.message ?? "認証が必要です");
  }

  if (!response.ok) {
    let message = payload?.message ?? "サーバーとの通信に失敗しました";
    if (response.status === 422 && payload?.errors) {
      const firstError = Object.values(payload.errors).flat()[0];
      if (firstError) {
        message = firstError;
      }
    }
    throw new ApiError(response.status, message);
  }

  return payload as T;
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

export async function uploadProfileAvatar(file: File): Promise<FirestoreProfile> {
  try {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await profileApiFetch<ProfileResponse>("/api/profile/avatar", {
      method: "POST",
      auth: true,
      body: formData,
    });
    return response.profile;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 422) {
        throw new ProfileAvatarError(error.message);
      }
      if (error.status === 401) {
        throw error;
      }
      throw new ProfileAvatarError();
    }
    throw new ProfileAvatarError();
  }
}

export async function deleteProfileAvatar(): Promise<FirestoreProfile> {
  try {
    const response = await profileApiFetch<ProfileResponse>("/api/profile/avatar", {
      method: "DELETE",
      auth: true,
    });
    return response.profile;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw error;
      }
      throw new ProfileAvatarError();
    }
    throw new ProfileAvatarError();
  }
}
