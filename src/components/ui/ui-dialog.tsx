"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export interface UiDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdropClick?: boolean;
}

const WIDTH: Record<NonNullable<UiDialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function UiDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdropClick = true,
}: UiDialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ui-dialog-title"
      className="fixed inset-0 z-[var(--z-modal,50)] flex items-center justify-center p-4"
    >
      <div
        aria-hidden
        onClick={closeOnBackdropClick ? onClose : undefined}
        className="absolute inset-0 bg-[color:color-mix(in_oklab,var(--canvas)_60%,black)] backdrop-blur-sm"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-3)] outline-none ${WIDTH[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="ui-dialog-title"
              className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ui-btn-ghost inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </button>
        </header>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_44%,transparent)] px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
