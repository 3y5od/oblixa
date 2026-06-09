import type { ReactNode } from "react";
import { CalendarClock, ClipboardCheck, FileText, Users, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChipPair } from "@/components/ui/chip-pair";
import { QuietFactChip } from "./auth-ui";

/** Static time marker styled to match the shared TimeChip bordered-neutral
 *  recipe exactly. The mock is static + aria-hidden, so we mirror the chip's
 *  classes rather than compute a relative date from "now". */
function TimeMarker({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium uppercase leading-none tracking-[0.12em] tabular-nums text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

/** Preserved-case meta-value chip (dates etc. — never shouting, §10.12). */
function MetaChip({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10.5px] font-medium leading-none tabular-nums text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

/** One signal row with a reserved status column so chips right-align to a clean
 *  vertical edge. */
function SignalRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} />
        {label}
      </span>
      <span className="flex min-w-[6rem] items-center justify-end gap-1.5">{children}</span>
    </div>
  );
}

/**
 * Decorative content-led "workspace slice" — a compact contract-work object, not
 * a generic card. Fully `aria-hidden`: a review item with structured date/notice
 * chips, a cited-source line, and owner/evidence/report signals aligned to one
 * right-hand status edge.
 */
export function AuthProductPreview() {
  return (
    <div
      aria-hidden
      className="rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_50%,var(--surface))] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="landing-eyebrow-dot ui-caps-2 text-[9.5px] text-[var(--text-tertiary)]">Review queue</span>
        <ChipPair primary="Contract" secondary="Master agreement" />
      </div>

      {/* Review item */}
      <div className="mt-3 flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[var(--surface)] text-[var(--text-tertiary)]">
          <CalendarClock className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">Notice deadline</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <MetaChip>Aug 14, 2026</MetaChip>
            <QuietFactChip>60-day notice</QuietFactChip>
          </div>
        </div>
        <StatusBadge status="in_review" className="shrink-0">
          Suggested
        </StatusBadge>
      </div>

      {/* Cited source — reads as a quote, not an editable field */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="ui-caps-3 shrink-0 text-[9px] text-[var(--text-tertiary)]">Source</span>
        <span className="truncate font-mono text-[11px] italic text-[var(--text-secondary)]">
          “…sixty (60) days written notice…”
        </span>
      </div>

      {/* Signals — owner, evidence, report on a fixed right edge */}
      <div className="mt-3 space-y-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-3">
        <SignalRow icon={Users} label="Owner assigned">
          <TimeMarker>2d</TimeMarker>
          <StatusBadge status="healthy">Confirmed</StatusBadge>
        </SignalRow>
        <SignalRow icon={ClipboardCheck} label="Evidence request">
          <StatusBadge status="warning">Due 5d</StatusBadge>
        </SignalRow>
        <SignalRow icon={FileText} label="Renewal report">
          <StatusBadge status="info">Ready</StatusBadge>
        </SignalRow>
      </div>
    </div>
  );
}
