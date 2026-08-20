"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useApp } from "@/context/AppProvider";
import { getBoardTitle } from "@/lib/family-utils";

type AppHeaderProps = {
  showLogin?: boolean;
  compact?: boolean;
  board?: boolean;
  members?: ReactNode;
};

export function AppHeader({
  showLogin = true,
  compact = false,
  board = false,
  members,
}: AppHeaderProps) {
  const { currentUser, currentFamily, isAuthenticated } = useApp();

  useEffect(() => {
    if (currentFamily?.name) {
      document.title = `${getBoardTitle(currentFamily.name)} | 家族共有タスク管理`;
    }
  }, [currentFamily?.name]);

  const title =
    isAuthenticated && currentFamily
      ? board
        ? currentFamily.name
        : getBoardTitle(currentFamily.name)
      : "タスクボード";

  return (
    <header
      className={
        board
          ? "shrink-0 border-b border-[#eadfce]/80 bg-[#fffdfb] px-4 py-2.5 lg:px-5"
          : compact
            ? "mb-2 border-b border-[#eadfce]/70 bg-[#fffdfb] px-1 py-2.5 sm:px-2"
            : "mb-5 rounded-3xl border border-amber-100 bg-white/95 p-3 shadow-sm backdrop-blur-md sm:p-4 sm:px-6"
      }
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${board ? "shrink-0" : "flex-1"}`}>
          <Link
            href="/"
            className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-xl ${
              board || compact
                ? "h-9 w-9 text-lg shadow-none"
                : "h-10 w-10 shadow-md shadow-amber-200 sm:h-12 sm:w-12 sm:text-2xl"
            }`}
          >
            🏡
          </Link>
          <Link href="/" className="min-w-0 truncate">
            <h1
              className={`truncate font-bold tracking-wide text-slate-800 ${
                board || compact
                  ? "text-base lg:text-lg"
                  : "text-sm sm:text-xl lg:text-2xl"
              }`}
            >
              {title}
            </h1>
          </Link>
          {board && currentFamily && (
            <Link
              href="/family"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-stone-100 hover:text-slate-600"
              aria-label="家族グループ管理"
              title="グループ管理"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          )}
        </div>

        {board && members}

        <div
          className={`flex shrink-0 items-center ${
            board ? "ml-3 gap-0 border-l border-[#eadfce]/80 pl-4" : "gap-1.5 sm:gap-2"
          }`}
        >
          {isAuthenticated && currentUser ? (
            <ProfileMenu accountMenu={board} />
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
