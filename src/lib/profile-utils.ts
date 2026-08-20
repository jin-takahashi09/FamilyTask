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

/** Prefer API avatarUrl, then the current user's saved avatarUrl, then local data URLs. */
export function withLocalProfileImage(
  user: UserProfile,
  existingUsers: UserProfile[],
): UserProfile {
  if (user.avatarUrl) {
    return user;
  }

  const existing = existingUsers.find((entry) => entry.id === user.id);
  if (existing?.avatarUrl) {
    return {
      ...user,
      avatarUrl: existing.avatarUrl,
      profileImage: null,
    };
  }

  const localImage = resolveLocalProfileImage(user.id, existingUsers);
  if (!localImage) return user;
  return { ...user, profileImage: localImage };
}

export function resolveProfileAvatarSrc(
  user: Pick<UserProfile, "avatarUrl" | "profileImage">,
): string | null {
  if (user.avatarUrl) {
    return user.avatarUrl;
  }

  if (user.profileImage?.startsWith("data:image/")) {
    return user.profileImage;
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
  const existing = existingUsers.find((user) => user.id === verified.uid);

  if (!firestoreProfile) {
    const hasLocalProfile = Boolean(
      existing?.profileCompleted && existing.displayName.trim(),
    );

    return {
      id: verified.uid,
      email: verified.email ?? existing?.email ?? "",
      displayName: existing?.displayName ?? "",
      profileImage: localImage,
      avatarUrl: existing?.avatarUrl ?? null,
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
    profileImage: firestoreProfile.avatarUrl ? null : localImage,
    avatarUrl: firestoreProfile.avatarUrl ?? null,
    profileCompleted: true,
  };
}

export function applySavedProfile(
  user: UserProfile,
  data: ProfileFormData,
  saved: FirestoreProfile,
  markCompleted: boolean,
): UserProfile {
  const uploadedToStorage = saved.avatarType === "image" && Boolean(saved.avatarUrl);

  return {
    ...user,
    id: saved.uid,
    email: saved.email,
    displayName: saved.displayName,
    avatarUrl: saved.avatarUrl ?? null,
    profileImage: uploadedToStorage
      ? null
      : data.profileImage?.startsWith("data:image/")
        ? data.profileImage
        : user.profileImage,
    profileCompleted: markCompleted ? true : user.profileCompleted,
  };
}

export function profileFromFirestore(saved: FirestoreProfile): UserProfile {
  return {
    id: saved.uid,
    email: saved.email,
    displayName: saved.displayName,
    profileImage: null,
    avatarUrl: saved.avatarUrl ?? null,
    profileCompleted: true,
  };
}

export function shouldUploadProfileAvatar(
  profileImage: string | null,
  initialProfileImage: string | null,
): boolean {
  return (
    profileImage !== null &&
    profileImage.startsWith("data:image/") &&
    profileImage !== initialProfileImage
  );
}

export function shouldDeleteProfileAvatar(
  profileImage: string | null,
  initialProfileImage: string | null,
  initialAvatarUrl: string | null,
): boolean {
  return (
    profileImage === null &&
    (Boolean(initialAvatarUrl) ||
      (initialProfileImage?.startsWith("data:image/") ?? false))
  );
}

export function profileFormInitialImage(
  user: Pick<UserProfile, "profileImage" | "avatarUrl">,
): string | null {
  return user.profileImage ?? user.avatarUrl ?? null;
}
