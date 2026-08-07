import type { ProfileFormData } from "@/components/ProfileForm";
import type { FirestoreProfile } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/types";

export const DISPLAY_NAME_MAX_LENGTH = 50;

export function profileFormToApiPayload(
  data: ProfileFormData,
): {
  displayName: string;
  avatarType: "none" | "initials";
  avatarValue: string;
} {
  return {
    displayName: data.displayName.trim(),
    avatarType: "none",
    avatarValue: "",
  };
}

export function resolveLocalProfileImage(
  uid: string,
  existingUsers: UserProfile[],
): string | null {
  const localUser = existingUsers.find((user) => user.id === uid);
  const image = localUser?.profileImage ?? null;

  if (image?.startsWith("data:image/")) {
    return image;
  }

  return null;
}

export type ProfileFetchStatus = "loaded" | "missing" | "unavailable";

export function mergeFirestoreProfile(
  verified: { uid: string; email: string | null },
  firestoreProfile: FirestoreProfile | null,
  existingUsers: UserProfile[],
  fetchStatus: ProfileFetchStatus = firestoreProfile ? "loaded" : "missing",
): UserProfile {
  const localImage = resolveLocalProfileImage(verified.uid, existingUsers);

  if (!firestoreProfile) {
    const existing = existingUsers.find((user) => user.id === verified.uid);
    const hasLocalProfile = Boolean(
      existing?.profileCompleted && existing.displayName.trim(),
    );

    return {
      id: verified.uid,
      email: verified.email ?? existing?.email ?? "",
      displayName: existing?.displayName ?? "",
      profileImage: localImage,
      profileCompleted:
        fetchStatus === "unavailable" && hasLocalProfile
          ? true
          : false,
    };
  }

  return {
    id: firestoreProfile.uid,
    email: firestoreProfile.email || verified.email || "",
    displayName: firestoreProfile.displayName,
    profileImage: localImage,
    profileCompleted: true,
  };
}

export function applySavedProfile(
  user: UserProfile,
  data: ProfileFormData,
  saved: FirestoreProfile,
  markCompleted: boolean,
): UserProfile {
  return {
    ...user,
    id: saved.uid,
    email: saved.email,
    displayName: saved.displayName,
    profileImage: data.profileImage,
    profileCompleted: markCompleted ? true : user.profileCompleted,
  };
}
