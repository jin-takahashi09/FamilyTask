"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { useApp } from "@/context/AppProvider";
import { FAMILY_LOCAL_STORAGE_NOTICE } from "@/lib/family-utils";

type SetupMode = "create" | "join";

function FamilySetupContent() {
  const { currentUser, hasFamily, createFamily, joinFamilyByInviteCode } =
    useApp();
  const router = useRouter();
  const [mode, setMode] = useState<SetupMode>("create");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasFamily) {
      router.replace("/");
    }
  }, [hasFamily, router]);

  if (!currentUser) return null;
  if (hasFamily) return null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await createFamily(familyName);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/");
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await joinFamilyByInviteCode(inviteCode);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-400 text-3xl shadow-md shadow-emerald-200">
          👨‍👩‍👧‍👦
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">
          家族グループの設定
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          タスクを共有する家族グループを作成するか、招待コードで参加してください
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setMode("create");
            setError("");
          }}
          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold transition-all ${
            mode === "create"
              ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
          }`}
        >
          新しい家族グループを作る
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("join");
            setError("");
          }}
          className={`rounded-2xl border px-4 py-3 text-sm font-extrabold transition-all ${
            mode === "join"
              ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs"
              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
          }`}
        >
          招待コードで参加する
        </button>
      </div>

      <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        {mode === "create" ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                家族グループ名
              </span>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="例: 高橋家"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-3 font-bold text-white shadow-md shadow-emerald-200 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
            >
              家族グループを作成
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">
                招待コード
              </span>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="例: ABC123"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold uppercase tracking-widest focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-3 font-bold text-white shadow-md shadow-emerald-200 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
            >
              参加する
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm font-bold text-rose-500">{error}</p>
        )}
      </div>

      <p className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-center text-xs leading-relaxed text-amber-800/80">
        {FAMILY_LOCAL_STORAGE_NOTICE}
      </p>
    </div>
  );
}

export default function FamilySetupPage() {
  return (
    <AuthGuard requireProfile requireFamily={false}>
      <FamilySetupContent />
    </AuthGuard>
  );
}
