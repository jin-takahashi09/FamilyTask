"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { Calendar } from "@/components/Calendar";
import { MyTodayTasks } from "@/components/MemberSidebar";
import { MemberSwitcher } from "@/components/MemberSwitcher";
import { SelectedDayTasks } from "@/components/SelectedDayTasks";
import { TodayTasksModal } from "@/components/TodayTasksModal";
import { useApp } from "@/context/AppProvider";
import { toDateKey } from "@/lib/date-utils";
import {
  homeHrefForSelection,
  parseSelectedUserIds,
  toggleSelectedUserId,
} from "@/lib/member-selection";

function HomeContentInner() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const { currentUser, isFamilyMember } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const usersParam = searchParams.get("users");
  const userParam = searchParams.get("user");

  const selectedUserIds = useMemo(() => {
    if (!currentUser) return [];
    return parseSelectedUserIds(
      usersParam,
      userParam,
      currentUser.id,
      isFamilyMember,
    );
  }, [usersParam, userParam, currentUser, isFamilyMember]);

  const handleSelectUser = useCallback(
    (userId: string) => {
      if (!currentUser) return;
      const next = toggleSelectedUserId(selectedUserIds, userId);
      router.replace(
        homeHrefForSelection(next.length > 0 ? next : [currentUser.id], currentUser.id),
        { scroll: false },
      );
    },
    [currentUser, router, selectedUserIds],
  );

  const handleSelectDate = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
  }, []);

  if (!currentUser) return null;

  const calendarProps = {
    currentMonth,
    onMonthChange: setCurrentMonth,
    userIds: selectedUserIds,
    currentUserId: currentUser.id,
    isSelf: selectedUserIds.length === 1 && selectedUserIds[0] === currentUser.id,
  };

  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-[90rem] flex-col overflow-hidden bg-[#fffdfb]">
      {/* スマホ・iPad縦向け（〜lg未満） */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
        <div className="shrink-0 px-3 pt-2 sm:px-4 sm:pt-3 md:px-6 md:pt-4">
          <AppHeader showLogin={false} compact />
        </div>

        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 pt-1 sm:px-4 md:gap-4 md:px-6 md:pb-4">
          <MemberSwitcher
            selectedUserIds={selectedUserIds}
            onSelectUser={handleSelectUser}
          />
          <Calendar
            {...calendarProps}
            compact
            hideUserBanner
            selectedDateKey={selectedDateKey}
            onSelectDate={handleSelectDate}
          />
          <SelectedDayTasks
            dateKey={selectedDateKey}
            userIds={selectedUserIds}
          />
        </main>

        <TodayTasksModal userIds={selectedUserIds} />
      </div>

      {/* PC / iPad横：1面のダッシュボード（lg〜）— 既存動作を維持 */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
        <AppHeader
          showLogin={false}
          board
          members={
            <MemberSwitcher
              variant="header"
              selectedUserIds={selectedUserIds}
              onSelectUser={handleSelectUser}
            />
          }
        />
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,71fr)_minmax(240px,29fr)] bg-[#fffdfb]">
          <div className="flex min-h-0 min-w-0 flex-col px-4 py-3 lg:px-5 lg:py-4">
            <Calendar {...calendarProps} compact hideUserBanner board />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col border-l border-[#eadfce]/80 bg-[#faf7f2] px-3 py-3 lg:px-4 lg:py-4">
            <MyTodayTasks fill board userIds={selectedUserIds} />
          </div>
        </main>
      </div>
    </div>
  );
}

function HomeContent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
          読み込み中...
        </div>
      }
    >
      <HomeContentInner />
    </Suspense>
  );
}

export default function HomePage() {
  return (
    <AuthGuard requireProfile requireFamily>
      <HomeContent />
    </AuthGuard>
  );
}
