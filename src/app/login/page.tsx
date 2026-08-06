"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { useApp } from "@/context/AppProvider";

type AuthMode = "login" | "register";

function AuthForm() {
  const { login, register, isAuthenticated, currentUser, hasFamily } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const redirectAfterAuth = (
    result: Awaited<ReturnType<typeof login>>,
  ) => {
    if (!result.success) return;
    if (!result.profileCompleted) {
      router.push("/profile/setup");
    } else if (!result.hasFamily) {
      router.push("/family/setup");
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, passwordConfirm);

      if (!result.success) {
        setError(result.error ?? "認証に失敗しました");
        return;
      }

      redirectAfterAuth(result);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-3xl shadow-md shadow-amber-200">
          🏡
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          {mode === "login" ? "ログイン" : "新規登録"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "login"
            ? "家族でタスクを共有するためにログインしてください"
            : "アカウントを作成してFamilyTaskを始めましょう"}
        </p>
      </div>

      <div className="mb-4 flex rounded-2xl bg-slate-100/80 p-1">
        <button
          type="button"
          aria-label={
            mode === "login"
              ? "ログインモード（選択中）"
              : "ログインモードに切り替え"
          }
          aria-pressed={mode === "login"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            mode === "login"
              ? "bg-white text-amber-900 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          aria-label={
            mode === "register"
              ? "新規登録モード（選択中）"
              : "新規登録モードに切り替え"
          }
          aria-pressed={mode === "register"}
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            mode === "register"
              ? "bg-white text-amber-900 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          新規登録
        </button>
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
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            パスワード
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </label>
        {mode === "register" && (
          <label className="mb-6 block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">
              パスワード確認
            </span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
          </label>
        )}

        {error && (
          <p className="mb-4 text-sm font-bold text-rose-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 font-bold text-white shadow-md shadow-amber-200 transition-all hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? "処理中..."
            : mode === "login"
              ? "ログイン"
              : "新規登録"}
        </button>

        {mode === "register" && (
          <p className="mt-4 text-center text-xs text-slate-400">
            パスワードは6文字以上で設定してください
          </p>
        )}
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
      <AuthForm />
    </AuthGuard>
  );
}
