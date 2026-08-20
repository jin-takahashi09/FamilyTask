"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { Calendar } from "@/components/Calendar";
import { MyTodayTasks } from "@/components/MemberSidebar";
import { MemberSwitcher } from "@/components/MemberSwitcher";
import { useApp } from "@/context/AppProvider";
import {
  homeHrefForSelection,
  parseSelectedUserIds,
  toggleSelectedUserId,
} from "@/lib/member-selection";

function HomeContentInner() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  if (!currentUser) return null;

  const calendarProps = {
    currentMonth,
    onMonthChange: setCurrentMonth,
    userIds: selectedUserIds,
    currentUserId: currentUser.id,
    isSelf: selectedUserIds.length === 1 && selectedUserIds[0] === currentUser.id,
  };

  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-[90rem] flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3 sm:px-4 sm:pt-4 md:hidden">
        <AppHeader showLogin={false} compact />
      </div>

      {/* スマホ専用レイアウト */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-2 pt-1 md:hidden">
        <MemberSwitcher
          selectedUserIds={selectedUserIds}
          onSelectUser={handleSelectUser}
        />
        <Calendar {...calendarProps} compact hideUserBanner />
        <MyTodayTasks compactMobile userIds={selectedUserIds} />
      </main>

      {/* PC：1面のダッシュボード */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
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
          <div className="flex min-h-0 min-w-0 flex-col border-l border-stone-200/80 bg-[#faf7f2] px-3 py-3 lg:px-4 lg:py-4">
            <MyTodayTasks fill board userIds={selectedUserIds} />
          </div>
        </main>
      </div>

      <p className="shrink-0 px-3 pb-3 pt-0 text-center text-xs text-amber-700/60 md:hidden">
        データはこの端末のブラウザに保存されます（お試し版）
      </p>
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
