"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { getShortUserLabel, getUserLabel } from "@/lib/user-utils";
import type { UserProfile } from "@/lib/types";

type MemberSwitcherProps = {
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
};

export function MemberSwitcher({
  selectedUserId,
  onSelectUser,
}: MemberSwitcherProps) {
  const { currentUser, familyMembers } = useApp();

  if (!currentUser) return null;

  const members = familyMembers.length > 0 ? familyMembers : [currentUser];

  return (
    <section className="md:hidden" aria-label="共有中のメンバー">
      <div className="mb-1 flex items-center gap-0.5">
        <h2 className="text-xs font-bold text-slate-700">共有中のメンバー</h2>
        <Link
          href="/family"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors active:bg-slate-100 active:text-slate-600"
          aria-label="家族グループ管理"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Link>
      </div>

      <p className="mb-2 text-[10px] leading-snug text-slate-400">
        メンバーをタップすると、その人のカレンダーを表示できます
      </p>

      <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex flex-nowrap items-start gap-4 pr-6">
          {members.map((user) => (
            <li key={user.id} className="shrink-0">
              <MemberIconChip
                user={user}
                isSelected={user.id === selectedUserId}
                onSelect={() => onSelectUser(user.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MemberIconChip({
  user,
  isSelected,
  onSelect,
}: {
  user: UserProfile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const label = getShortUserLabel(user, 8);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${getUserLabel(user)}のカレンダーを表示`}
      className="flex w-[3.5rem] flex-col items-center gap-1.5 active:opacity-80"
    >
      <div
        className={`rounded-full p-[2.5px] transition-all ${
          isSelected
            ? "bg-gradient-to-tr from-amber-400 to-orange-400 shadow-sm"
            : "bg-slate-200/70"
        }`}
      >
        <UserAvatar user={user} size="md" className="!h-11 !w-11 !text-sm" />
      </div>
      <span
        className={`block w-full text-center text-[10px] leading-tight ${
          isSelected ? "font-bold text-slate-800" : "font-medium text-slate-500"
        }`}
      >
        {label}
      </span>
      {isSelected && (
        <span
          className="h-0.5 w-5 rounded-full bg-amber-500"
          aria-hidden
        />
      )}
    </button>
  );
}
