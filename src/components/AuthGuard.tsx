"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppProvider";

type AuthGuardProps = {
  children: React.ReactNode;
  requireProfile?: boolean;
  requireFamily?: boolean;
  redirectIfAuthenticated?: boolean;
};

export function AuthGuard({
  children,
  requireProfile = true,
  requireFamily = true,
  redirectIfAuthenticated = false,
}: AuthGuardProps) {
  const { isReady, currentUser, isAuthenticated, hasFamily } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    if (redirectIfAuthenticated && isAuthenticated) {
      if (!currentUser?.profileCompleted) {
        router.replace("/profile/setup");
      } else if (!hasFamily) {
        router.replace("/family/setup");
      } else {
        router.replace("/");
      }
      return;
    }

    if (!redirectIfAuthenticated && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (
      !redirectIfAuthenticated &&
      requireProfile &&
      isAuthenticated &&
      !currentUser?.profileCompleted
    ) {
      router.replace("/profile/setup");
      return;
    }

    if (
      !redirectIfAuthenticated &&
      requireFamily &&
      isAuthenticated &&
      currentUser?.profileCompleted &&
      !hasFamily
    ) {
      router.replace("/family/setup");
    }
  }, [
    isReady,
    isAuthenticated,
    currentUser,
    hasFamily,
    requireProfile,
    requireFamily,
    redirectIfAuthenticated,
    router,
  ]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
        読み込み中...
      </div>
    );
  }

  if (redirectIfAuthenticated && isAuthenticated) return null;
  if (!redirectIfAuthenticated && !isAuthenticated) return null;
  if (
    !redirectIfAuthenticated &&
    requireProfile &&
    isAuthenticated &&
    !currentUser?.profileCompleted
  ) {
    return null;
  }
  if (
    !redirectIfAuthenticated &&
    requireFamily &&
    isAuthenticated &&
    currentUser?.profileCompleted &&
    !hasFamily
  ) {
    return null;
  }

  return <>{children}</>;
}
