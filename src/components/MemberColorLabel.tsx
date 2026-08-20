"use client";

import { getMemberCalendarColor } from "@/lib/member-calendar-colors";
import { getShortUserLabel, getUserLabel } from "@/lib/user-utils";
import type { UserProfile } from "@/lib/types";

type MemberColorDotProps = {
  userId: string;
  className?: string;
};

/** メンバーカラーと一致する小さな丸（dot クラスを共通利用） */
export function MemberColorDot({ userId, className = "h-2 w-2" }: MemberColorDotProps) {
  const { dot } = getMemberCalendarColor(userId);
  return <span className={`inline-block shrink-0 rounded-full ${dot} ${className}`} aria-hidden />;
}

type SelectedMembersDisplayProps = {
  members: UserProfile[];
  prefix?: string | null;
  className?: string;
  itemClassName?: string;
  useShortLabel?: boolean;
};

/** 選択中メンバーを色付きドット＋名前で表示 */
export function SelectedMembersDisplay({
  members,
  prefix = "表示中：",
  className = "",
  itemClassName = "",
  useShortLabel = true,
}: SelectedMembersDisplayProps) {
  if (members.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}
      aria-label={
        prefix
          ? `${prefix}${members.map((m) => getUserLabel(m)).join("、")}`
          : members.map((m) => getUserLabel(m)).join("、")
      }
    >
      {prefix ? (
        <span className="shrink-0 text-xs font-bold text-slate-500">{prefix}</span>
      ) : null}
      {members.map((member) => {
        const color = getMemberCalendarColor(member.id);
        const label = useShortLabel
          ? getShortUserLabel(member, 8)
          : getUserLabel(member);
        return (
          <span
            key={member.id}
            className={`inline-flex items-center gap-1 ${itemClassName}`}
          >
            <MemberColorDot userId={member.id} />
            <span className={`text-xs font-bold ${color.text}`}>{label}</span>
          </span>
        );
      })}
    </div>
  );
}

type AssigneeBadgeProps = {
  userId: string;
  name: string;
};

/** タスク担当者（色ドット＋名前） */
export function AssigneeBadge({ userId, name }: AssigneeBadgeProps) {
  const color = getMemberCalendarColor(userId);

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-stone-200/80 bg-white px-2 py-0.5 text-[11px] font-bold">
      <MemberColorDot userId={userId} className="h-2 w-2" />
      <span className={color.text}>{name}</span>
    </span>
  );
}
