"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { ProfileForm } from "@/components/ProfileForm";
import { useApp } from "@/context/AppProvider";

function ProfileSetupContent() {
  const { currentUser, completeProfile, hasFamily } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser?.profileCompleted) return;
    if (!hasFamily) {
      router.replace("/family/setup");
    } else {
      router.replace("/");
    }
  }, [currentUser, hasFamily, router]);

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
            profileImage: currentUser.profileImage,
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
