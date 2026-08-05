"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useApp } from "@/context/AppProvider";
import { getBoardTitle } from "@/lib/family-utils";

type AppHeaderProps = {
  showLogin?: boolean;
};

export function AppHeader({ showLogin = true }: AppHeaderProps) {
  const { currentUser, currentFamily, isAuthenticated } = useApp();

  useEffect(() => {
    if (currentFamily?.name) {
      document.title = `${getBoardTitle(currentFamily.name)} | 家族共有タスク管理`;
    }
  }, [currentFamily?.name]);

  return (
    <header className="mb-5 rounded-3xl border border-amber-100 bg-white/95 p-3 shadow-sm backdrop-blur-md sm:p-4 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-xl shadow-md shadow-amber-200 sm:h-12 sm:w-12 sm:text-2xl"
          >
            🏡
          </Link>
          <Link href="/" className="min-w-0 truncate">
            <h1 className="truncate text-sm font-bold tracking-wide text-slate-800 sm:text-xl lg:text-2xl">
              {isAuthenticated && currentFamily
                ? getBoardTitle(currentFamily.name)
                : "タスクボード"}
            </h1>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isAuthenticated && currentUser ? (
            <ProfileMenu />
          ) : (
            showLogin && (
              <Link
                href="/login"
                className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 sm:px-3 sm:py-2"
              >
                ログイン
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
