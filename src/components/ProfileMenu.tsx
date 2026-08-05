"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppProvider";

export function ProfileMenu() {
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

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  if (!currentUser) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 transition-colors hover:bg-amber-100"
        aria-label="プロフィールメニューを開く"
        aria-expanded={open}
      >
        <UserAvatar user={currentUser} size="sm" />
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
              logout();
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
