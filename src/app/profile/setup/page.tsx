"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { ProfileForm } from "@/components/ProfileForm";
import { useApp } from "@/context/AppProvider";
import { profileFormInitialImage } from "@/lib/profile-utils";

function ProfileSetupContent() {
  const { currentUser, completeProfile, hasFamily, isReady, sessionInitializing } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");

  const sessionSettled = isReady && !sessionInitializing;

  useEffect(() => {
    if (!currentUser?.profileCompleted || !sessionSettled) return;
    if (!hasFamily) {
      router.replace("/family/setup");
    } else {
      router.replace("/");
    }
  }, [currentUser, hasFamily, sessionSettled, router]);

  if (!sessionSettled) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-amber-700">
        読み込み中...
      </div>
    );
  }

  if (!currentUser) return null;

  if (currentUser.profileCompleted) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">
          プロフィールを設定
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          はじめに、あなたの表示名とプロフィール画像を設定しましょう
        </p>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm sm:p-8">
        {error && (
          <p className="mb-4 text-sm font-bold text-rose-500">{error}</p>
        )}
        <ProfileForm
          initial={{
            displayName: currentUser.displayName,
            profileImage: profileFormInitialImage(currentUser),
          }}
          submitLabel="設定を完了する"
          onSubmit={async (data) => {
            const result = await completeProfile(currentUser.id, data);
            if (!result.success) {
              setError(result.error ?? "プロフィールを保存できませんでした");
              return;
            }
            router.push("/family/setup");
          }}
        />
        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-xs font-bold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            別のアカウントでログイン
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileSetupPage() {
  return (
    <AuthGuard requireProfile={false} requireFamily={false}>
      <ProfileSetupContent />
    </AuthGuard>
  );
}
