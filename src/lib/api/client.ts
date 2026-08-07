import { getFirebaseAuth } from "@/lib/firebase/client";
import { getEchoSocketId } from "@/lib/realtime/echo";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = false, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set("Accept", "application/json");

  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

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
    });
  } catch {
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
