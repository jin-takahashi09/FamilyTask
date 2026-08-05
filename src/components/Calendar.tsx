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
} from "@/lib/task-utils";
import { getUserLabel } from "@/lib/user-utils";
import { useApp } from "@/context/AppProvider";
import { UserAvatar } from "@/components/UserAvatar";

type CalendarProps = {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  userId?: string;
  assigneeOnly?: boolean;
  isSelf?: boolean;
  compact?: boolean;
  hideUserBanner?: boolean;
};

export function Calendar({
  currentMonth,
  onMonthChange,
  userId,
  assigneeOnly = false,
  isSelf = false,
  compact = false,
  hideUserBanner = false,
}: CalendarProps) {
  const { familyTasks, getUserById } = useApp();
  const days = getCalendarDays(currentMonth);
  const user = userId ? getUserById(userId) : undefined;
  const taskFilter = { userId, assigneeOnly };

  const getDayLink = (dateKey: string) => {
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
        compact
          ? "max-md:rounded-2xl max-md:bg-white max-md:px-1 max-md:py-2 max-md:shadow-sm md:rounded-3xl md:border md:border-amber-100 md:p-5 md:shadow-sm lg:p-6"
          : "rounded-3xl border border-amber-100 p-5 shadow-sm sm:p-6"
      }`}
    >
      {user && (
        <div
          className={`mb-4 items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 ${
            hideUserBanner ? "hidden md:flex" : "flex"
          } ${compact ? "max-md:p-2.5 md:p-3" : "p-3"}`}
        >
          <UserAvatar user={user} size={compact ? "md" : "lg"} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">
              {isSelf
                ? "自分のタスクカレンダー"
                : `${getUserLabel(user)} のカレンダー`}
            </p>
            <p
              className={`truncate font-extrabold text-slate-800 ${
                compact ? "max-md:text-base md:text-lg" : "text-lg"
              }`}
            >
              {getUserLabel(user)}
            </p>
          </div>
        </div>
      )}

      <div
        className={`flex items-center justify-between ${
          compact ? "max-md:mb-3 md:mb-6" : "mb-6"
        }`}
      >
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className={`flex items-center justify-center rounded-2xl bg-amber-50 font-bold text-amber-700 transition-colors hover:bg-amber-100 ${
            compact ? "max-md:h-9 max-md:w-9 md:h-10 md:w-10" : "h-10 w-10"
          }`}
          aria-label="前の月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2
          className={`flex items-center gap-1.5 font-extrabold text-slate-800 ${
            compact ? "max-md:text-base md:text-xl lg:text-2xl" : "text-xl sm:text-2xl"
          }`}
        >
          <CalendarDays
            className={`text-amber-500 ${
              compact ? "max-md:h-4 max-md:w-4 md:h-5 md:w-5" : "h-5 w-5"
            }`}
          />
          {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
        </h2>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className={`flex items-center justify-center rounded-2xl bg-amber-50 font-bold text-amber-700 transition-colors hover:bg-amber-100 ${
            compact ? "max-md:h-9 max-md:w-9 md:h-10 md:w-10" : "h-10 w-10"
          }`}
          aria-label="次の月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`grid grid-cols-7 text-center ${
          compact ? "max-md:mb-1.5 max-md:gap-0.5 md:mb-3 md:gap-1" : "mb-3 gap-1"
        }`}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={label}
            className={`font-extrabold ${
              compact ? "max-md:py-1 max-md:text-[10px] md:py-1.5 md:text-sm" : "py-1.5 text-sm"
            } ${
              i === 0
                ? "text-rose-500"
                : i === 6
                  ? "text-sky-500"
                  : "text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className={`grid min-w-0 grid-cols-7 ${
          compact ? "max-md:gap-0.5 md:gap-2" : "gap-2"
        }`}
      >
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const inMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const { status, incompleteCount } = getCalendarDayStatus(
            familyTasks,
            dateKey,
            taskFilter,
          );
          const dotCount = getCalendarDotCount(incompleteCount);

          return (
            <Link
              key={dateKey}
              href={getDayLink(dateKey)}
              className={`group relative flex min-w-0 flex-col items-center justify-between rounded-xl border transition-all ${
                compact
                  ? "max-md:h-11 max-md:p-0.5 md:h-20 md:rounded-2xl md:p-2"
                  : "h-14 rounded-2xl p-2 sm:h-20"
              } ${
                isCurrentDay
                  ? "border-amber-300 bg-amber-50 font-bold text-amber-800 hover:border-amber-400"
                  : "border-slate-100 bg-slate-50/70 text-slate-700 hover:border-amber-200 hover:bg-amber-50/80"
              } ${!inMonth ? "opacity-30" : ""}`}
            >
              <span
                className={`font-bold ${
                  compact ? "max-md:text-xs md:text-base" : "text-sm sm:text-base"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
                {status === "pending" && (
                  <>
                    <div className="flex justify-center gap-0.5">
                      {Array.from({ length: dotCount }, (_, index) => (
                        <span
                          key={index}
                          className={`rounded-full bg-orange-400 ${
                            compact ? "h-1.5 w-1.5" : "h-2 w-2"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <span
                      className={`truncate font-extrabold text-amber-700 ${
                        compact
                          ? "max-w-full text-[9px] leading-none md:text-[10px]"
                          : "text-[10px] sm:text-[11px]"
                      }`}
                    >
                      {incompleteCount}件
                    </span>
                  </>
                )}
                {status === "allComplete" && (
                  <span
                    className="flex items-center justify-center"
                    aria-label="この日のタスクはすべて完了しています"
                  >
                    <Check
                      className={`text-slate-400 ${
                        compact ? "h-3 w-3 md:h-3.5 md:w-3.5" : "h-3.5 w-3.5"
                      }`}
                      aria-hidden
                    />
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
