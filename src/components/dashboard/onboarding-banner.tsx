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
    <Check size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden />
  ) : (
    <Circle size={16} className="mt-0.5 shrink-0 text-gray-300" aria-hidden />
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
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-blue-900">Get to your first reliable dates</p>
          <ul className="mt-3 space-y-2">
            <li className="flex gap-2">
              <StepIcon done={step1} />
              <span>
                <Link href="/contracts/new" className="font-medium underline hover:text-blue-700">
                  Upload
                </Link>{" "}
                at least one contract (or use{" "}
                <Link href="/contracts/bulk" className="font-medium underline hover:text-blue-700">
                  bulk import
                </Link>
                ).
              </span>
            </li>
            <li className="flex gap-2">
              <StepIcon done={step2} />
              <span>
                Run <strong>Extract fields with AI</strong>, then review each field with a source
                snippet before approving.
              </span>
            </li>
            <li className="flex gap-2">
              <StepIcon done={step3} />
              <span>
                Approve at least one operational date so{" "}
                <Link href="/dashboard" className="font-medium underline hover:text-blue-700">
                  reminders and the dashboard
                </Link>{" "}
                can use it.
              </span>
            </li>
          </ul>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Got it"}
        </button>
      </div>
    </div>
  );
}
