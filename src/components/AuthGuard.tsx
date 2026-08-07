"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppProvider";
import { getPostLoginPath } from "@/lib/family-utils";

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
  const {
    isReady,
    currentUser,
    isAuthenticated,
    hasFamily,
    familiesLoading,
    sessionInitializing,
    profileLoadError,
    memberships,
  } = useApp();
  const router = useRouter();

  const sessionSettled =
    isReady && !sessionInitializing && (!requireFamily || !familiesLoading);

  useEffect(() => {
    if (!sessionSettled) return;
    if (profileLoadError && requireProfile) return;

    if (redirectIfAuthenticated && isAuthenticated && currentUser?.profileCompleted) {
      router.replace(getPostLoginPath(currentUser, memberships));
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
    sessionSettled,
    isAuthenticated,
    currentUser,
    hasFamily,
    profileLoadError,
    memberships,
    requireProfile,
    requireFamily,
    redirectIfAuthenticated,
    router,
  ]);

  if (!isReady || sessionInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
        読み込み中...
      </div>
    );
  }

  if (requireFamily && familiesLoading && !hasFamily) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
        グループ情報を読み込み中...
      </div>
    );
  }

  if (
    profileLoadError &&
    !currentUser?.profileCompleted &&
    requireProfile
  ) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-center">
        <p className="text-sm font-bold text-rose-500">{profileLoadError}</p>
        <p className="mt-2 text-xs text-slate-500">
          プロフィール未設定とは異なるエラーです。接続を確認して再度お試しください。
        </p>
      </div>
    );
  }

  if (redirectIfAuthenticated && isAuthenticated && currentUser?.profileCompleted) {
    return null;
  }
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
    !hasFamily &&
    sessionSettled
  ) {
    return null;
  }

  return <>{children}</>;
}
