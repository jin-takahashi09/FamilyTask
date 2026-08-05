"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import TodayPageContent from "./TodayPageContent";

export default function TodayPage() {
  return (
    <AuthGuard requireProfile>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
            読み込み中...
          </div>
        }
      >
        <TodayPageContent />
      </Suspense>
    </AuthGuard>
  );
}
