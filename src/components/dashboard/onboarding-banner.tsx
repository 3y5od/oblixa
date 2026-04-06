"use client";

import { useState, useTransition } from "react";
import { completeProductOnboarding } from "@/actions/settings";
import Link from "next/link";
import { Check, Circle } from "lucide-react";

export interface OnboardingActivationStats {
  contractCount: number;
  hasExtractions: boolean;
  approvedOperationalDates: number;
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <Check
      size={16}
      className="mt-0.5 shrink-0 text-emerald-600"
      strokeWidth={2}
      aria-hidden
    />
  ) : (
    <Circle
      size={16}
      className="mt-0.5 shrink-0 text-zinc-300"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function OnboardingBanner({ stats }: { stats: OnboardingActivationStats }) {
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const step1 = stats.contractCount >= 1;
  const step2 = stats.hasExtractions;
  const step3 = stats.approvedOperationalDates >= 1;

  if (dismissed) return null;

  function dismiss() {
    setError(null);
    startTransition(async () => {
      const result = await completeProductOnboarding();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setDismissed(true);
    });
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/40 via-white to-white"
      role="region"
      aria-label="Getting started checklist"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" aria-hidden />
      <div className="flex flex-col gap-6 px-6 py-6 pl-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ui-eyebrow text-[var(--accent)]">Onboarding</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">
            Establish your first reliable dates
          </p>
          <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-zinc-600">
            <li className="flex gap-3">
              <StepIcon done={step1} />
              <span>
                <Link href="/contracts/new" className="ui-link">
                  Upload
                </Link>{" "}
                a contract (or{" "}
                <Link href="/contracts/bulk" className="ui-link">
                  bulk import
                </Link>
                ).
              </span>
            </li>
            <li className="flex gap-3">
              <StepIcon done={step2} />
              <span>
                Run <strong className="font-semibold text-zinc-800">Extract fields with AI</strong>
                , then use the{" "}
                <Link href="/contracts/review" className="ui-link">
                  review queue
                </Link>{" "}
                — source citations are required before approval.
              </span>
            </li>
            <li className="flex gap-3">
              <StepIcon done={step3} />
              <span>
                Approve at least one operational date so{" "}
                <Link href="/dashboard" className="ui-link">
                  reminders and reporting
                </Link>{" "}
                can use it.
              </span>
            </li>
          </ul>
          {error && <p className="mt-3 text-xs font-medium text-red-700">{error}</p>}
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          className="ui-btn-primary shrink-0 px-5 py-2.5"
        >
          {isPending ? "Saving…" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
