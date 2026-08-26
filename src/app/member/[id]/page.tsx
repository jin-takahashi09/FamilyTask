"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { Calendar } from "@/components/Calendar";
import { useApp } from "@/context/AppProvider";
import { getUserLabel } from "@/lib/user-utils";

type MemberPageProps = {
  params: Promise<{ id: string }>;
};

function MemberPageContent({ userId }: { userId: string }) {
  const { getUserById, currentUser, isFamilyMember } = useApp();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const user = getUserById(userId);
  const isSelf = currentUser?.id === userId;

  useEffect(() => {
    if (user && !isFamilyMember(userId)) {
      router.replace("/");
    }
  }, [user, userId, isFamilyMember, router]);

  if (!user || !user.profileCompleted || !isFamilyMember(userId)) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-extrabold text-slate-800">
          メンバーが見つかりません
        </p>
        <Link
          href="/"
          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-white"
        >
          自分のカレンダーに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 p-3 sm:p-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-amber-50"
      >
        <ArrowLeft className="h-4 w-4" />
        {isSelf ? "自分のカレンダーに戻る" : `${getUserLabel(user)} の表示を終了`}
      </Link>

      <main className="flex flex-col gap-5">
        <Calendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          userId={userId}
          isSelf={isSelf}
        />
      </main>
    </div>
  );
}

export default function MemberPage({ params }: MemberPageProps) {
  const { id: userId } = use(params);

  return (
    <AuthGuard requireProfile>
      <MemberPageContent userId={userId} />
    </AuthGuard>
  );
}
