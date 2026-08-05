"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { ProfileForm } from "@/components/ProfileForm";
import { useApp } from "@/context/AppProvider";

function ProfileEditContent() {
  const { currentUser, updateProfile } = useApp();
  const router = useRouter();

  if (!currentUser) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-5 px-4 py-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        カレンダーに戻る
      </Link>

      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">
          プロフィール編集
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          表示名とプロフィール画像を変更できます
        </p>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm sm:p-8">
        <ProfileForm
          initial={{
            displayName: currentUser.displayName,
            profileImage: currentUser.profileImage,
          }}
          submitLabel="変更を保存"
          onCancel={() => router.push("/")}
          onSubmit={(data) => {
            updateProfile(currentUser.id, data);
            router.push("/");
          }}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard requireProfile>
      <ProfileEditContent />
    </AuthGuard>
  );
}
