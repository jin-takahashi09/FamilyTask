"use client";

import { AppToast } from "@/components/AppToast";

type TaskCreateUndoToastProps = {
  count: number;
  onUndo: () => void;
  onDismiss: () => void;
};

export function TaskCreateUndoToast({
  count,
  onUndo,
  onDismiss,
}: TaskCreateUndoToastProps) {
  return (
    <AppToast
      message={`${count}件の繰り返しタスクを作成しました`}
      onUndo={onUndo}
      onDismiss={onDismiss}
    />
  );
}
