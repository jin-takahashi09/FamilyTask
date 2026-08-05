"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { useApp } from "@/context/AppProvider";

function LoginForm() {
  const { login, isAuthenticated, currentUser, hasFamily } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (!currentUser.profileCompleted) {
      router.replace("/profile/setup");
    } else if (!hasFamily) {
      router.replace("/family/setup");
    } else {
      router.replace("/");
    }
  }, [isAuthenticated, currentUser, hasFamily, router]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }

    const result = login(email, password);
    if (!result.success) {
      setError("ログインに失敗しました");
      return;
    }

    if (!result.profileCompleted) {
      router.push("/profile/setup");
    } else if (!result.hasFamily) {
      router.push("/family/setup");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-3xl shadow-md shadow-amber-200">
          🏡
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">ログイン</h1>
        <p className="mt-2 text-sm text-slate-500">
          家族でタスクを共有するためにログインしてください
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm"
      >
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            メールアドレス
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            パスワード
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>

        {error && (
          <p className="mb-4 text-sm font-bold text-rose-500">{error}</p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 font-bold text-white shadow-md shadow-amber-200 transition-all hover:from-amber-500 hover:to-orange-500"
        >
          ログイン
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          ※ お試し版のため、任意のメールアドレスでログインできます
        </p>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        未ログインの場合、カレンダーは表示できません
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthGuard requireProfile={false} requireFamily={false} redirectIfAuthenticated>
      <LoginForm />
    </AuthGuard>
  );
}
