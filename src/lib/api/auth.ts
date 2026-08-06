import { apiFetch } from "@/lib/api/client";

export type AuthMeResponse = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/api/auth/me", { auth: true });
}
