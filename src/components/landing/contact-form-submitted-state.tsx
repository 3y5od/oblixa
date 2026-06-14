"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

export function SubmittedState() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-8 text-center sm:py-12"
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          borderColor: "color-mix(in oklab, var(--success-ink) 24%, var(--border-subtle))",
          background: "color-mix(in oklab, var(--success-soft) 30%, var(--surface-raised))",
          color: "var(--success-ink)",
        }}
      >
        <CheckCircle2 className="h-6 w-6" strokeWidth={1.85} />
      </span>
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] outline-none"
        >
          Request received.
        </h2>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
          Thanks. If there is a fit, we will follow up with a few questions about your current
          tracker and whether a bounded first workspace makes sense.
        </p>
        <p className="mx-auto mt-2.5 max-w-[42ch] text-[12.5px] leading-[1.55] text-[var(--text-tertiary)]">
          Submitting a request does not create an account or charge a card. Not every request
          becomes a workspace, and reply times vary.
        </p>
      </div>
    </div>
  );
}
