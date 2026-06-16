"use client";

import Link from "next/link";
import { EyeOff, Lock, ShieldCheck, type LucideIcon } from "lucide-react";

function ProofChip({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--text-tertiary)]">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
      {children}
    </span>
  );
}

export function AuthTrustProof() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <ProofChip icon={ShieldCheck}>Encrypted in transit</ProofChip>
        <ProofChip icon={Lock}>Workspace-scoped</ProofChip>
        <ProofChip icon={EyeOff}>No data on public pages</ProofChip>
        <Link
          href="/security"
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          Security
        </Link>
      </div>
      <p className="text-center text-[11px] leading-snug text-[var(--text-tertiary)]">
        Workspace data is visible only after sign-in and workspace access checks.
      </p>
    </div>
  );
}
