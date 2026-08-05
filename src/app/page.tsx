"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { Calendar } from "@/components/Calendar";
import { MemberSidebar, MyTodayTasks } from "@/components/MemberSidebar";
import { MemberSwitcher } from "@/components/MemberSwitcher";
import { useApp } from "@/context/AppProvider";

function HomeContent() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { currentUser } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const effectiveUserId = selectedUserId ?? currentUser?.id ?? "";

  if (!currentUser || !effectiveUserId) return null;

  const isSelf = effectiveUserId === currentUser.id;

  const calendarProps = {
    currentMonth,
    onMonthChange: setCurrentMonth,
    userId: effectiveUserId,
    assigneeOnly: true as const,
    isSelf,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col overflow-x-hidden">
      <div className="p-3 pb-0 sm:p-6 sm:pb-0">
        <AppHeader showLogin={false} />
      </div>

      {/* スマホ専用レイアウト */}
      <main className="flex flex-col gap-3 px-3 pb-2 pt-1 md:hidden">
        <MemberSwitcher
          selectedUserId={effectiveUserId}
          onSelectUser={setSelectedUserId}
        />
        <Calendar {...calendarProps} compact hideUserBanner />
        {isSelf && (
          <div className="mt-2 pt-1">
            <MyTodayTasks compactMobile />
          </div>
        )}
      </main>

      {/* PC / タブレット */}
      <main className="hidden flex-grow items-start gap-5 p-3 pt-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(200px,28%)] md:p-6 md:pt-2 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          <Calendar {...calendarProps} />
          {isSelf && <MyTodayTasks />}
        </div>
        <MemberSidebar
          selectedUserId={effectiveUserId}
          onSelectUser={setSelectedUserId}
        />
      </main>

      <p className="px-3 pb-3 pt-2 text-center text-xs text-amber-700/60 sm:px-6 sm:pb-6">
        データはこの端末のブラウザに保存されます（お試し版）
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard requireProfile requireFamily>
      <HomeContent />
    </AuthGuard>
  );
}
