"use client";

import { useState, type ReactNode } from "react";
import { UiDialog } from "@/components/ui/ui-dialog";
import { UiSpinner } from "@/components/ui/ui-spinner";

export interface UiConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function UiConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: UiConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <UiDialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={title}
      description={description}
      size="sm"
      closeOnBackdropClick={!pending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] ${
              destructive ? "ui-btn-danger" : "ui-btn-primary"
            }`}
          >
            {pending ? <UiSpinner size="xs" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
