"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";
import {
  getMemberCalendarColor,
  type MemberCalendarColor,
} from "@/lib/member-calendar-colors";
import { getShortUserLabel, getUserLabel } from "@/lib/user-utils";
import type { UserProfile } from "@/lib/types";

/** PCヘッダーに直接表示するメンバー数の上限 */
const HEADER_VISIBLE_LIMIT = 5;

type MemberSwitcherProps = {
  selectedUserIds: string[];
  onSelectUser: (userId: string) => void;
  variant?: "mobile" | "header";
};

export function MemberSwitcher({
  selectedUserIds,
  onSelectUser,
  variant = "mobile",
}: MemberSwitcherProps) {
  const { currentUser, familyMembers } = useApp();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (variant !== "header" || !overflowOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setOverflowOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOverflowOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [variant, overflowOpen]);

  if (!currentUser) return null;

  const members = familyMembers.length > 0 ? familyMembers : [currentUser];

  if (variant === "header") {
    const visibleMembers = members.slice(0, HEADER_VISIBLE_LIMIT);
    const overflowMembers = members.slice(HEADER_VISIBLE_LIMIT);
    const overflowSelectedCount = overflowMembers.filter((user) =>
      selectedUserIds.includes(user.id),
    ).length;

    return (
      <section className="min-w-0 flex-1" aria-label="共有中のメンバー">
        <ul
          id="family-member-list"
          className="flex flex-wrap items-center justify-end gap-1 px-2 lg:gap-1.5"
        >
          {visibleMembers.map((user) => (
            <li key={user.id} className="shrink-0">
              <MemberIconChip
                user={user}
                isSelected={selectedUserIds.includes(user.id)}
                onSelect={() => onSelectUser(user.id)}
                variant="header"
              />
            </li>
          ))}

          {overflowMembers.length > 0 && (
            <li className="relative shrink-0" ref={overflowRef}>
              <button
                type="button"
                onClick={() => setOverflowOpen((prev) => !prev)}
                aria-expanded={overflowOpen}
                aria-haspopup="listbox"
                aria-label={`他${overflowMembers.length}人のメンバーを表示`}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  overflowSelectedCount > 0
                    ? "border-stone-300 bg-stone-50 text-slate-700"
                    : "border-transparent bg-stone-100 text-slate-600 hover:bg-stone-200"
                }`}
              >
                +{overflowMembers.length}人
              </button>

              {overflowOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-lg"
                  role="listbox"
                  aria-label="その他のメンバー"
                >
                  <ul className="custom-scrollbar max-h-56 overflow-y-auto py-1">
                    {overflowMembers.map((user) => (
                      <OverflowMemberRow
                        key={user.id}
                        user={user}
                        isSelected={selectedUserIds.includes(user.id)}
                        onSelect={() => onSelectUser(user.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="lg:hidden" aria-label="共有中のメンバー">
      <div className="mb-1.5 flex items-center gap-0.5">
        <h2 className="text-xs font-bold text-slate-700">共有中のメンバー</h2>
        <Link
          href="/family"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#a8927a] transition-colors active:bg-[#fff5eb] active:text-slate-600"
          aria-label="家族グループ管理"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
        <ul className="flex flex-nowrap items-start gap-3 pr-6 md:flex-wrap md:gap-3 md:pr-0">
          {members.map((user) => (
            <li key={user.id} className="shrink-0">
              <MemberIconChip
                user={user}
                isSelected={selectedUserIds.includes(user.id)}
                onSelect={() => onSelectUser(user.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** メンバー色の細いリング（2px）— getMemberCalendarColor の ring / dot と一致 */
function MemberColorRing({
  userId,
  isSelected,
  children,
}: {
  userId: string;
  isSelected: boolean;
  children: ReactNode;
}) {
  const color = getMemberCalendarColor(userId);

  return (
    <div
      className={`shrink-0 rounded-full p-[2px] ${
        isSelected ? color.ring : "bg-[#e8dfd2]"
      }`}
    >
      {children}
    </div>
  );
}

function OverflowMemberRow({
  user,
  isSelected,
  onSelect,
}: {
  user: UserProfile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = getMemberCalendarColor(user.id);

  return (
    <li role="option" aria-selected={isSelected}>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-stone-50 ${
          isSelected ? memberSelectedSurface(color) : ""
        }`}
      >
        <MemberColorRing userId={user.id} isSelected={isSelected}>
          <UserAvatar user={user} size="sm" className="!h-9 !w-9 !text-xs" />
        </MemberColorRing>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            isSelected ? `font-bold ${color.text}` : "font-medium text-slate-700"
          }`}
        >
          {getUserLabel(user)}
        </span>
      </button>
    </li>
  );
}

function memberSelectedSurface(color: MemberCalendarColor): string {
  return color.border;
}

function MemberIconChip({
  user,
  isSelected,
  onSelect,
  variant = "mobile",
}: {
  user: UserProfile;
  isSelected: boolean;
  onSelect: () => void;
  variant?: "mobile" | "header";
}) {
  const label = getShortUserLabel(user, 8);
  const color = getMemberCalendarColor(user.id);

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`${getUserLabel(user)}のカレンダーを${isSelected ? "非表示" : "表示"}`}
        className={`flex items-center gap-2 rounded-full border px-2 py-1.5 transition-colors ${
          isSelected
            ? memberSelectedSurface(color)
            : "border-transparent hover:bg-[#fff5eb]"
        }`}
      >
        <MemberColorRing userId={user.id} isSelected={isSelected}>
          <UserAvatar user={user} size="sm" className="!h-9 !w-9 !text-xs" />
        </MemberColorRing>
        <span
          className={`max-w-[5rem] truncate text-sm ${
            isSelected ? `font-bold ${color.text}` : "font-medium text-slate-600"
          }`}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${getUserLabel(user)}のカレンダーを${isSelected ? "非表示" : "表示"}`}
      className={`flex w-[3.75rem] flex-col items-center gap-1 rounded-xl px-1 py-1 transition-colors active:bg-[#fff5eb] md:w-auto md:min-w-0 md:flex-row md:gap-2 md:rounded-full md:border md:px-2.5 md:py-1.5 ${
        isSelected
          ? `${memberSelectedSurface(color)} bg-[#fff8f0]`
          : "border-transparent md:hover:bg-[#fff5eb]"
      }`}
    >
      <MemberColorRing userId={user.id} isSelected={isSelected}>
        <UserAvatar
          user={user}
          size="md"
          className="!h-10 !w-10 !text-sm md:!h-9 md:!w-9 md:!text-xs"
        />
      </MemberColorRing>
      <span
        className={`block w-full text-center text-[10px] leading-tight md:max-w-[5rem] md:truncate md:text-left md:text-sm ${
          isSelected
            ? `font-bold ${color.text}`
            : "font-medium text-[#9a8b7a] md:text-slate-600"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
