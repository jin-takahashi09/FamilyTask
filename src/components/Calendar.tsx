"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  addMonths,
  getCalendarDays,
  isSameMonth,
  isToday,
  subMonths,
  toDateKey,
  WEEKDAY_LABELS,
} from "@/lib/date-utils";
import {
  getCalendarDayStatus,
  getCalendarDotCount,
  getCalendarMemberDayMarks,
} from "@/lib/task-utils";
import { getMemberCalendarColor } from "@/lib/member-calendar-colors";
import { dayHrefForSelection } from "@/lib/member-selection";
import { getUserLabel } from "@/lib/user-utils";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";
import { SelectedMembersDisplay } from "@/components/MemberColorLabel";

type CalendarProps = {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  userId?: string;
  userIds?: string[];
  currentUserId?: string;
  assigneeOnly?: boolean;
  isSelf?: boolean;
  compact?: boolean;
  hideUserBanner?: boolean;
  board?: boolean;
  /** 月間カレンダー上で強調する日（親から渡された場合のみ） */
  selectedDateKey?: string;
  /**
   * 指定時は日付タップでページ遷移せずコールバックする（スマホ用）。
   * 未指定時は従来どおり /day/[date] へ遷移（PC維持）。
   */
  onSelectDate?: (dateKey: string) => void;
};

export function Calendar({
  currentMonth,
  onMonthChange,
  userId,
  userIds,
  currentUserId,
  assigneeOnly = false,
  isSelf = false,
  compact = false,
  hideUserBanner = false,
  board = false,
  selectedDateKey,
  onSelectDate,
}: CalendarProps) {
  const { familyTasks, getUserById } = useApp();
  const days = getCalendarDays(currentMonth);
  const selectedUserIds = userIds ?? (userId ? [userId] : []);
  const isMulti = selectedUserIds.length > 1;
  const primaryUserId = selectedUserIds.length === 1 ? selectedUserIds[0] : undefined;
  const user = primaryUserId ? getUserById(primaryUserId) : undefined;
  const selectedUsers = selectedUserIds
    .map((id) => getUserById(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  /** PC board / スマホ・タブレット compact で共有する暖色カレンダー面 */
  const soft = board || compact;

  const getDayLink = (dateKey: string) => {
    if (selectedUserIds.length > 0 && currentUserId) {
      return dayHrefForSelection(dateKey, selectedUserIds, currentUserId);
    }
    if (userId) {
      const params = new URLSearchParams({ user: userId });
      if (assigneeOnly) params.set("mine", "1");
      return `/day/${dateKey}?${params.toString()}`;
    }
    return `/day/${dateKey}`;
  };

  return (
    <div
      className={`flex min-w-0 flex-grow flex-col ${
        board
          ? "h-full min-h-0"
          : compact
            ? "rounded-xl bg-[#fff8f0] px-1.5 py-2 md:px-3 md:py-3"
            : "rounded-3xl border border-amber-100 p-5 shadow-sm sm:p-6"
      }`}
    >
      {(user || isMulti || selectedUserIds.length === 0) && (
        <div
          className={`mb-4 items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 ${
            hideUserBanner || board ? "hidden" : "flex"
          } ${compact ? "max-md:p-2.5 md:p-3" : "p-3"}`}
        >
          {isMulti ? (
            <div className="flex -space-x-2">
              {selectedUsers.map((entry) => {
                const color = getMemberCalendarColor(entry.id);
                return (
                  <div
                    key={entry.id}
                    className={`rounded-full p-[2px] ${color.ring}`}
                  >
                    <UserAvatar
                      user={entry}
                      size={compact ? "sm" : "md"}
                      className="ring-2 ring-white"
                    />
                  </div>
                );
              })}
            </div>
          ) : user ? (
            <div className={`rounded-full p-[2px] ${getMemberCalendarColor(user.id).ring}`}>
              <UserAvatar user={user} size={compact ? "md" : "lg"} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">
              {selectedUserIds.length === 0
                ? "メンバーを選ぶとカレンダーに表示されます"
                : isMulti
                  ? `${selectedUserIds.length}人のカレンダーを同時表示`
                  : isSelf
                    ? "自分のタスクカレンダー"
                    : user
                      ? `${getUserLabel(user)} のカレンダー`
                      : "カレンダー"}
            </p>
            <p
              className={`truncate font-extrabold text-slate-800 ${
                compact ? "max-md:text-base md:text-lg" : "text-lg"
              }`}
            >
              {isMulti
                ? selectedUsers.map((entry) => getUserLabel(entry)).join(" / ")
                : user
                  ? getUserLabel(user)
                  : "未選択"}
            </p>
          </div>
        </div>
      )}

      <div className={`shrink-0 ${soft ? "mb-2 md:mb-2.5" : "mb-4"}`}>
        <div
          className={`flex items-center justify-between ${
            soft ? "rounded-xl bg-[#fff5eb]/70 px-1.5 py-1.5 md:px-2 md:py-2" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className={`flex items-center justify-center font-bold ${
              soft
                ? "h-8 w-8 rounded-lg bg-white/90 text-amber-800/70 transition-all duration-150 hover:bg-amber-50 hover:text-amber-800 active:bg-amber-50 md:h-9 md:w-9"
                : "h-10 w-10 rounded-2xl bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100"
            }`}
            aria-label="前の月"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2
            className={`flex items-center gap-1.5 font-extrabold text-slate-800 md:gap-2 ${
              soft
                ? "text-sm tracking-wide md:text-base lg:text-lg"
                : "text-xl sm:text-2xl"
            }`}
          >
            <CalendarDays
              className={`text-amber-500 ${soft ? "h-4 w-4 md:h-5 md:w-5" : "h-5 w-5"}`}
            />
            <span>
              {currentMonth.getFullYear()}年{" "}
              <span className="text-amber-700">{currentMonth.getMonth() + 1}月</span>
            </span>
          </h2>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className={`flex items-center justify-center font-bold ${
              soft
                ? "h-8 w-8 rounded-lg bg-white/90 text-amber-800/70 transition-all duration-150 hover:bg-amber-50 hover:text-amber-800 active:bg-amber-50 md:h-9 md:w-9"
                : "h-10 w-10 rounded-2xl bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100"
            }`}
            aria-label="次の月"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {selectedUsers.length > 0 && (
          <SelectedMembersDisplay
            members={selectedUsers}
            className={soft ? "mt-2 px-1" : "mt-2 justify-center"}
          />
        )}
      </div>

      <div
        className={`grid shrink-0 grid-cols-7 text-center ${
          soft ? "mb-2 gap-0 pb-1 md:mb-2.5 md:pb-1.5" : "mb-3 gap-1"
        }`}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={label}
            className={`font-bold ${
              soft
                ? "py-0.5 text-[10px] tracking-wide md:text-[11px]"
                : "py-1.5 text-sm font-extrabold"
            } ${
              i === 0
                ? "text-rose-500"
                : i === 6
                  ? "text-sky-500"
                  : soft
                    ? "text-[#a8927a]"
                    : "text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className={`grid min-h-0 min-w-0 grid-cols-7 ${
          board
            ? "min-h-0 flex-1 auto-rows-fr gap-1.5 rounded-xl bg-[#fff8f0] p-1.5"
            : compact
              ? "gap-1.5 md:gap-2"
              : "gap-2"
        }`}
      >
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const marks = selectedUserIds.length
            ? getCalendarMemberDayMarks(
                familyTasks,
                dateKey,
                selectedUserIds,
                currentUserId,
              )
            : [];
          const pendingMarks = marks.filter((mark) => !mark.allComplete);
          const incompleteCount = pendingMarks.reduce(
            (sum, mark) => sum + mark.incompleteCount,
            0,
          );
          const status = pendingMarks.length
            ? "pending"
            : marks.length
              ? "allComplete"
              : "empty";
          const isFocusedDay = selectedDateKey === dateKey;
          const totalCount = selectedUserIds.reduce((sum, uid) => {
            const { totalCount: dayTotal } = getCalendarDayStatus(
              familyTasks,
              dateKey,
              {
                userId: uid,
                assigneeOnly: Boolean(currentUserId) && uid === currentUserId,
              },
            );
            return sum + dayTotal;
          }, 0);
          const singleColor = primaryUserId
            ? getMemberCalendarColor(primaryUserId)
            : null;
          const softDotCount = isMulti
            ? marks.length
            : status === "allComplete"
              ? 1
              : getCalendarDotCount(incompleteCount);
          const legacyDotCount = isMulti
            ? pendingMarks.length
            : getCalendarDotCount(incompleteCount);

          const cellClassName = `group relative flex min-h-0 min-w-0 flex-col items-center transition-all duration-150 ${
            soft
              ? `${
                  board
                    ? "h-full min-h-[2.75rem] lg:min-h-[3.25rem]"
                    : "min-h-[3.25rem] md:min-h-[4.5rem]"
                } rounded-lg px-1 pt-1 md:px-1.5 md:pt-1.5 ${
                  marks.length === 0 ? "justify-start" : "justify-between"
                }`
              : "h-14 justify-between rounded-2xl border p-2 sm:h-20"
          } ${
            soft
              ? `${
                  isFocusedDay
                    ? "bg-amber-50/85 ring-1 ring-amber-200/45"
                    : isCurrentDay
                      ? "bg-amber-50/40"
                      : inMonth
                        ? "bg-[#fffcf8]"
                        : "bg-[#fffdf9]/90"
                } text-slate-700 hover:bg-amber-50/80 active:bg-amber-50/90 md:hover:shadow-[0_1px_3px_rgba(245,158,11,0.07)] md:hover:-translate-y-px`
              : isCurrentDay
                ? "border-amber-400 bg-amber-50 font-bold text-amber-900"
                : "border-slate-100 bg-slate-50/70 text-slate-700 hover:border-amber-200 hover:bg-amber-50/80"
          } ${!inMonth && !soft ? "opacity-30" : ""}`;

          const cellInner = (
            <>
              <span
                className={`flex shrink-0 items-center justify-center font-bold ${
                  soft
                    ? `text-xs leading-none md:text-sm ${
                        isCurrentDay
                          ? "rounded-full bg-amber-500/90 px-1.5 py-0.5 text-white md:px-2"
                          : inMonth
                            ? "text-slate-800"
                            : "text-stone-400/75"
                      }`
                    : "text-sm sm:text-base"
                }`}
              >
                {day.getDate()}
              </span>
              <div
                className={`flex w-full min-w-0 flex-col items-center gap-0.5 pb-0.5 ${
                  soft && marks.length === 0 ? "hidden" : ""
                }`}
              >
                {soft ? (
                  <>
                    <div className="flex flex-wrap justify-center gap-0.5">
                      {isMulti
                        ? marks.map((mark) => (
                            <span
                              key={mark.userId}
                              className={`h-1.5 w-1.5 rounded-full md:h-2 md:w-2 ${getMemberCalendarColor(mark.userId).dot}`}
                              aria-hidden
                            />
                          ))
                        : Array.from({ length: softDotCount }, (_, index) => (
                            <span
                              key={index}
                              className={`h-1.5 w-1.5 rounded-full md:h-2 md:w-2 ${singleColor?.dot ?? "bg-amber-500"}`}
                              aria-hidden
                            />
                          ))}
                    </div>
                    {totalCount > 0 && (
                      <span
                        className={`max-w-full truncate text-[9px] font-semibold leading-none md:text-[10px] ${
                          status === "allComplete"
                            ? "text-[#b8a48f]"
                            : isMulti
                              ? "text-[#9a8b7a]"
                              : singleColor?.text ?? "text-amber-800"
                        }`}
                      >
                        {totalCount}件
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {status === "pending" && (
                      <>
                        <div className="flex flex-wrap justify-center gap-0.5">
                          {isMulti
                            ? pendingMarks.map((mark) => (
                                <span
                                  key={mark.userId}
                                  className={`h-2 w-2 rounded-full ${getMemberCalendarColor(mark.userId).dot}`}
                                  aria-hidden
                                />
                              ))
                            : Array.from({ length: legacyDotCount }, (_, index) => (
                                <span
                                  key={index}
                                  className={`h-2 w-2 rounded-full ${
                                    singleColor?.dot ?? "bg-amber-500"
                                  }`}
                                  aria-hidden
                                />
                              ))}
                        </div>
                        <span
                          className={`truncate text-[10px] font-extrabold sm:text-[11px] ${
                            isMulti
                              ? "text-slate-500"
                              : singleColor?.text ?? "text-amber-800"
                          }`}
                        >
                          {totalCount}件
                        </span>
                      </>
                    )}
                    {status === "allComplete" && (
                      <span
                        className="flex items-center justify-center"
                        aria-label="この日のタスクはすべて完了しています"
                      >
                        <Check
                          className="h-3.5 w-3.5 text-emerald-400"
                          aria-hidden
                        />
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          );

          if (onSelectDate) {
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={cellClassName}
                aria-pressed={isFocusedDay}
                aria-label={`${day.getMonth() + 1}月${day.getDate()}日を選択`}
              >
                {cellInner}
              </button>
            );
          }

          return (
            <Link
              key={dateKey}
              href={getDayLink(dateKey)}
              className={cellClassName}
            >
              {cellInner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
