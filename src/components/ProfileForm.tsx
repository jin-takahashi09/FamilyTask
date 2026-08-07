"use client";

import { FormEvent, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import {
  isProfileImageWithinSizeLimit,
  processProfileImage,
  PROFILE_IMAGE_PROCESS_FAILED_MESSAGE,
  PROFILE_IMAGE_TOO_LARGE_MESSAGE,
} from "@/lib/profile-image";
import type { UserProfile } from "@/lib/types";

export type ProfileFormData = {
  displayName: string;
  profileImage: string | null;
};

type ProfileFormProps = {
  initial: Pick<UserProfile, "displayName" | "profileImage">;
  submitLabel: string;
  onSubmit: (data: ProfileFormData) => void | Promise<void>;
  onCancel?: () => void;
};

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [profileImage, setProfileImage] = useState<string | null>(
    initial.profileImage,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  const previewUser = {
    displayName,
    profileImage,
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      e.target.value = "";
      return;
    }

    if (!isProfileImageWithinSizeLimit(file.size)) {
      setError(PROFILE_IMAGE_TOO_LARGE_MESSAGE);
      e.target.value = "";
      return;
    }

    setError("");
    setProcessingImage(true);
    try {
      const processed = await processProfileImage(file);
      setProfileImage(processed);
    } catch {
      setError(PROFILE_IMAGE_PROCESS_FAILED_MESSAGE);
    } finally {
      setProcessingImage(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("表示名を入力してください");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        displayName: displayName.trim(),
        profileImage,
      });
    } catch {
      setError("プロフィールを保存できませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        <UserAvatar user={previewUser} size="xl" />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={processingImage || submitting}
          onChange={handleImageChange}
        />
        <button
          type="button"
          disabled={processingImage || submitting}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
          {processingImage ? "画像を処理中..." : "プロフィール画像を選択"}
        </button>
        {profileImage && (
          <button
            type="button"
            onClick={() => setProfileImage(null)}
            className="text-xs font-bold text-slate-400 hover:text-rose-500"
          >
            画像を削除
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">
          表示名 <span className="text-rose-500">*</span>
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: 仁"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
        <p className="mt-1 text-xs text-slate-400">
          タスクの依頼者・担当者として表示される名前です
        </p>
      </label>

      {error && <p className="text-sm font-bold text-rose-500">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || processingImage}
          className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processingImage
            ? "画像を処理中..."
            : submitting
              ? "保存中..."
              : submitLabel}
        </button>
      </div>
    </form>
  );
}
