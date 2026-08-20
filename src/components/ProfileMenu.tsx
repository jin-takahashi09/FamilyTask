"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppProvider";

type ProfileMenuProps = {
  /** PCダッシュボード用：アカウントメニューとして見せる */
  accountMenu?: boolean;
};

export function ProfileMenu({ accountMenu = false }: ProfileMenuProps) {
  const { currentUser, logout } = useApp();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!currentUser) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          accountMenu
            ? "flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-2 py-1.5 transition-colors hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100"
            : "relative h-10 w-10 shrink-0 rounded-full transition-opacity hover:opacity-90 active:opacity-80 sm:h-11 sm:w-11"
        }
        aria-label="アカウントメニューを開く"
        aria-expanded={open}
      >
        <UserAvatar
          user={currentUser}
          size="md"
          className={
            accountMenu
              ? "!h-9 !w-9 !bg-stone-100 !text-xs"
              : "!h-10 !w-10 !bg-transparent !text-sm sm:!h-11 sm:!w-11 sm:!text-base"
          }
        />
        {accountMenu && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg sm:w-48"
          role="menu"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-amber-50"
          >
            <User className="h-4 w-4 text-amber-600" />
            プロフィール編集
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4 text-slate-500" />
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
