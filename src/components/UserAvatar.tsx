"use client";

import Image from "next/image";
import { getUserInitials } from "@/lib/user-utils";
import type { UserProfile } from "@/lib/types";

type UserAvatarProps = {
  user: Pick<UserProfile, "displayName" | "profileImage">;
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

  if (user.profileImage) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-amber-100 ${sizeClass} ${className}`}
      >
        <Image
          src={user.profileImage}
          alt={user.displayName || "プロフィール"}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
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
