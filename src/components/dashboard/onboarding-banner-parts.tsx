"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";

export type OnboardingRowKey =
  | "setup"
  | "upload"
  | "review"
  | "owner"
  | "approve"
  | "work"
  | "dashboard";

export type OnboardingBannerRow = {
  done: boolean;
  href: string;
  actionLabel: string;
  detail: string;
  el: ReactNode;
};

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <Check
      size={16}
      className="mt-0.5 shrink-0 text-[var(--success-ink)]"
      strokeWidth={1.85}
      aria-hidden
    />
  ) : (
    <Circle
      size={16}
      className="mt-0.5 shrink-0 text-[var(--text-tertiary)]"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function OnboardingChecklist({
  orderedKeys,
  rows,
}: {
  orderedKeys: OnboardingRowKey[];
  rows: Record<OnboardingRowKey, OnboardingBannerRow>;
}) {
  return (
    <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
      {orderedKeys.map((key) => (
        <li key={key} className="flex gap-3">
          <StepIcon done={rows[key].done} />
          <div>
            {rows[key].el}
            <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">{rows[key].detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OnboardingBannerActions({
  href,
  actionLabel,
  isPending,
  onDismiss,
}: {
  href: string;
  actionLabel: string;
  isPending: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
      <Link
        href={href}
        className="ui-btn-primary inline-flex min-h-9 items-center gap-2 px-5 py-2.5"
      >
        {actionLabel}
        <ArrowRight size={14} aria-hidden />
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        disabled={isPending}
        className="ui-btn-secondary min-h-9 px-5 py-2.5"
      >
        {isPending ? "Saving..." : "Hide for now"}
      </button>
    </div>
  );
}
