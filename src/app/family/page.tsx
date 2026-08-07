"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmDialog, DeleteFamilyDialog } from "@/components/ConfirmDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppProvider";
import { FAMILY_LOCAL_STORAGE_NOTICE } from "@/lib/family-utils";
import { getUserLabel } from "@/lib/user-utils";

type Section = "main" | "create" | "join";

function FamilyPageContent() {
  const router = useRouter();
  const {
    currentUser,
    currentFamily,
    currentMembership,
    familyMembers,
    userFamilies,
    activeFamilyId,
    switchFamily,
    createFamily,
    joinFamilyByInviteCode,
    removeFamilyMember,
    transferOwnership,
    leaveFamily,
    deleteFamily,
    regenerateInviteCode,
  } = useApp();

  const [section, setSection] = useState<Section>("main");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  if (!currentUser || !currentFamily || !currentMembership) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-extrabold text-slate-800">
          家族グループが見つかりません
        </p>
        <Link
          href="/family/setup"
          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-white"
        >
          家族グループを設定する
        </Link>
      </div>
    );
  }

  const isOwner = currentMembership.role === "owner";
  const otherMembers = familyMembers.filter((m) => m.id !== currentUser.id);
  const canLeaveAsOwner =
    isOwner && otherMembers.length === 0
      ? false
      : !isOwner;

  const resetMessages = () => {
    setMessage("");
    setError("");
  };

  const handleSwitch = (familyId: string) => {
    resetMessages();
    const result = switchFamily(familyId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage("グループを切り替えました");
    router.push("/");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await createFamily(familyName);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setFamilyName("");
    setSection("main");
    setMessage("新しいグループを作成しました");
    router.push("/");
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await joinFamilyByInviteCode(inviteCode);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setInviteCode("");
    setSection("main");
    setMessage("グループに参加しました");
    router.push("/");
  };

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(currentFamily.inviteCode);
      setInviteCopied(true);
      setMessage("招待コードをコピーしました");
      setError("");
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setInviteCopied(false);
      setError("コピーに失敗しました");
    }
  };

  const handleRegenerate = async () => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await regenerateInviteCode();
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage("招待コードを再発行しました");
  };

  const handleRemoveMember = async (userId: string) => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await removeFamilyMember(userId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRemoveTarget(null);
    setMessage("メンバーをグループから外しました");
  };

  const handleTransfer = async (userId: string) => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await transferOwnership(userId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTransferTarget(null);
    setMessage("オーナー権限を移譲しました");
  };

  const handleLeave = async () => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await leaveFamily();
    setSubmitting(false);
    setLeaveDialogOpen(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(result.redirectTo ?? "/");
  };

  const handleDelete = async (confirmName: string) => {
    if (submitting) return;
    resetMessages();
    setSubmitting(true);
    const result = await deleteFamily(confirmName);
    setSubmitting(false);
    setDeleteDialogOpen(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(result.redirectTo ?? "/");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-3 sm:p-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-amber-50"
      >
        <ArrowLeft className="h-4 w-4" />
        カレンダーに戻る
      </Link>

      <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-400 text-2xl">
            👨‍👩‍👧‍👦
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 sm:text-2xl">
              家族管理
            </h1>
            <p className="text-xs font-bold text-emerald-700">
              {currentFamily.name} ·{" "}
              {currentMembership.role === "owner" ? "オーナー" : "メンバー"}
            </p>
          </div>
        </div>

        {message && (
          <p className="mb-4 text-sm font-bold text-emerald-600">{message}</p>
        )}
        {error && (
          <p className="mb-4 text-sm font-bold text-rose-500">{error}</p>
        )}

        {/* Group switcher */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-extrabold text-slate-800">
            グループ切り替え
          </h2>
          <ul className="flex flex-col gap-2">
            {userFamilies.map((family) => (
              <li key={family.id}>
                <button
                  type="button"
                  onClick={() => handleSwitch(family.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                    family.id === activeFamilyId
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-slate-100 bg-slate-50/70 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <span className="truncate">{family.name}</span>
                  {family.id === activeFamilyId && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Create / Join */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-extrabold text-slate-800">
            グループの追加
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setSection("create");
                resetMessages();
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" />
              新しいグループを作る
            </button>
            <button
              type="button"
              onClick={() => {
                setSection("join");
                resetMessages();
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100"
            >
              <UserPlus className="h-4 w-4" />
              招待コードで参加
            </button>
          </div>

          {section === "create" && (
            <form onSubmit={handleCreate} className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <label className="mb-3 block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">
                  グループ名
                </span>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="例: 高橋家"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSection("main")}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  作成
                </button>
              </div>
            </form>
          )}

          {section === "join" && (
            <form onSubmit={handleJoin} className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <label className="mb-3 block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">
                  招待コード
                </span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="例: ABC123"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold uppercase tracking-widest focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSection("main")}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                >
                  参加
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Invite code */}
        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="mb-2 text-xs font-bold text-slate-600">招待コード</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-emerald-200 bg-white px-4 py-2 font-mono text-lg font-extrabold tracking-widest text-emerald-800">
              {currentFamily.inviteCode}
            </span>
            <button
              type="button"
              onClick={handleCopyInviteCode}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                inviteCopied
                  ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                  : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              {inviteCopied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {inviteCopied ? "コピーしました" : "コピー"}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                再発行
              </button>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <Users className="h-4 w-4 text-emerald-600" />
            メンバー一覧 ({familyMembers.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {familyMembers.map((member) => {
              const isSelf = member.id === currentUser.id;
              const isMemberOwner = member.role === "owner";

              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={member} size="md" />
                    <div>
                      <p className="text-sm font-extrabold text-slate-800">
                        {getUserLabel(member)}
                        {isSelf && (
                          <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            自分
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isMemberOwner ? "オーナー" : "メンバー"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOwner && !isSelf && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTransferTarget(member.id)}
                          className="flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50"
                        >
                          <Crown className="h-3.5 w-3.5" />
                          オーナーに移譲
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member.id)}
                          className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Danger zone */}
        <section className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
          <h2 className="mb-3 text-sm font-extrabold text-rose-700">
            危険な操作
          </h2>
          <div className="flex flex-col gap-2">
            {canLeaveAsOwner && (
              <button
                type="button"
                onClick={() => setLeaveDialogOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                このグループから退出
              </button>
            )}
            {isOwner && otherMembers.length > 0 && (
              <p className="text-xs text-rose-600/80">
                オーナーは退出する前に、オーナー権限の移譲またはグループの削除を行ってください。
              </p>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-400 bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                グループを削除
              </button>
            )}
          </div>
        </section>
      </div>

      <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-center text-xs leading-relaxed text-amber-800/80">
        {FAMILY_LOCAL_STORAGE_NOTICE}
      </p>

      <ConfirmDialog
        open={leaveDialogOpen}
        title="グループから退出"
        message={`「${currentFamily.name}」から退出しますか？このグループのタスクは表示されなくなります。`}
        confirmLabel="退出する"
        onConfirm={handleLeave}
        onCancel={() => setLeaveDialogOpen(false)}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title="メンバーを削除"
        message="このメンバーをグループから外します。ユーザーのプロフィールやタスクは削除されません。"
        confirmLabel="削除する"
        onConfirm={() => removeTarget && handleRemoveMember(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={transferTarget !== null}
        title="オーナー権限の移譲"
        message="オーナー権限をこのメンバーに移譲します。移譲後、あなたは一般メンバーになり、退出が可能になります。"
        confirmLabel="移譲する"
        danger={false}
        onConfirm={() => transferTarget && handleTransfer(transferTarget)}
        onCancel={() => setTransferTarget(null)}
      />

      <DeleteFamilyDialog
        open={deleteDialogOpen}
        familyName={currentFamily.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

export default function FamilyPage() {
  return (
    <AuthGuard requireProfile requireFamily>
      <FamilyPageContent />
    </AuthGuard>
  );
}
