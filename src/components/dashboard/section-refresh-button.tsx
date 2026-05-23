"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

interface SectionRefreshButtonProps {
  label?: string;
}

export function SectionRefreshButton({ label = "Refresh" }: SectionRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function onClick(): void {
    setJustRefreshed(false);
    startTransition(() => {
      router.refresh();
      setJustRefreshed(true);
      window.setTimeout(() => setJustRefreshed(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      title={label}
      aria-label={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-tint-soft)] hover:text-[var(--text-primary)] focus-visible:bg-[var(--surface-tint-soft)] focus-visible:outline-none disabled:opacity-50"
    >
      <RotateCw
        className={`h-3 w-3 ${isPending ? "animate-spin" : ""} ${justRefreshed ? "text-[var(--success-ink)]" : ""}`.trim()}
        strokeWidth={1.85}
        aria-hidden
      />
    </button>
  );
}
