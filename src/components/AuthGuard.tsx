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
  const {
    isReady,
    currentUser,
    isAuthenticated,
    hasFamily,
    familiesLoading,
    profileLoadError,
  } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isReady || profileLoadError || familiesLoading) return;

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
    profileLoadError,
    familiesLoading,
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

  if (familiesLoading && requireFamily) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
        グループ情報を読み込み中...
      </div>
    );
  }

  if (profileLoadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-center">
        <p className="text-sm font-bold text-rose-500">{profileLoadError}</p>
        <p className="mt-2 text-xs text-slate-500">
          プロフィール未設定とは異なるエラーです。接続を確認して再度お試しください。
        </p>
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
    !hasFamily &&
    !familiesLoading
  ) {
    return null;
  }

  return <>{children}</>;
}
