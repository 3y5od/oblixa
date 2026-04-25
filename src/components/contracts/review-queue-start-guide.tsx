"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

const REVIEW_QUEUE_GUIDE_DISMISSED_KEY = "oblixa.contracts.reviewQueueStartGuide.dismissed";

export function ReviewQueueStartGuide({
  nextContractHref,
  children,
}: {
  nextContractHref: string;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(REVIEW_QUEUE_GUIDE_DISMISSED_KEY) === "true";
  });

  function hideGuide() {
    window.localStorage.setItem(REVIEW_QUEUE_GUIDE_DISMISSED_KEY, "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <section className="ui-card-hero overflow-hidden" aria-label="Review queue getting started guide">
      <div className="flex flex-col gap-5 border-b border-[var(--border-subtle)]/90 bg-[radial-gradient(circle_at_top_right,var(--canvas-glow),transparent_24%),linear-gradient(180deg,color-mix(in_oklab,var(--surface)_92%,white),var(--surface-raised))] px-5 py-6 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="ui-eyebrow">Start here</p>
            <h2 className="ui-page-title text-[1.75rem]">Work straight through the queue</h2>
            <p className="ui-page-lead max-w-3xl">
              Open the highest-priority contract, review its pending fields, then continue to the next contract without returning to the list. Critical date gaps, open exceptions, and evidence blockers stay visible before you commit downstream state.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={nextContractHref} className="ui-btn-primary px-4 py-2">
              Open next contract
            </Link>
            <Link href="/contracts" className="ui-btn-secondary px-4 py-2">
              Browse all contracts
            </Link>
            <button type="button" onClick={hideGuide} className="ui-btn-secondary px-4 py-2">
              Hide guide
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
      </div>
    </section>
  );
}
