"use client";

import { resolveProfileAvatarSrc } from "@/lib/profile-utils";
import { getUserInitials } from "@/lib/user-utils";
import type { UserProfile } from "@/lib/types";

type UserAvatarProps = {
  user: Pick<UserProfile, "displayName" | "profileImage" | "avatarUrl">;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeMap = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

export function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const sizeClass = sizeMap[size];
  const imageSrc = resolveProfileAvatarSrc(user);

  if (imageSrc) {
    return (
      // Signed Storage URLs and data URLs fail with next/image; use a plain img.
      <img
        src={imageSrc}
        alt={user.displayName || "プロフィール"}
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 font-extrabold text-white ${sizeClass} ${className}`}
    >
      {getUserInitials(user)}
    </div>
  );
}
