import { Fragment, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";

export const mockDateClassName =
  "min-w-[3.75rem] shrink-0 text-right text-[12.5px] tabular-nums text-[var(--text-secondary)]";
export const selectedRowClass =
  "relative bg-[color:color-mix(in_oklab,var(--accent-soft)_40%,var(--surface-raised))]";
export const zebraRowClass = "bg-[color:color-mix(in_oklab,var(--surface-muted)_32%,transparent)]";

export function SelectedBar() {
  return <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent-strong)]" />;
}

/** Secondary row action — steel, not cobalt (directive 45): cobalt is
    reserved for the primary action of the selected object. */
export function RowActionQuiet({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-[12.5px] font-medium text-[var(--text-secondary)] underline decoration-[var(--border-contrast)] underline-offset-[3px]">
      {children}
    </span>
  );
}

/** Renders "Head · Tail" with the middle dot styled as an intentional
    separator (.ui-dot-sep). Splits on the first " · " only. */
export function DottedLabel({
  value,
  headClassName,
  tailClassName,
}: {
  value: string;
  headClassName?: string;
  tailClassName?: string;
}) {
  const idx = value.indexOf(" · ");
  if (idx === -1) return <span className={headClassName}>{value}</span>;
  return (
    <>
      <span className={headClassName}>{value.slice(0, idx)}</span>
      <span className="ui-dot-sep" aria-hidden>
        ·
      </span>
      <span className={tailClassName}>{value.slice(idx + 3)}</span>
    </>
  );
}

/** Consistent owner initials avatar. */
export function OwnerAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-contrast)] font-mono text-[10.5px] font-bold tabular-nums text-[var(--text-secondary)]"
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** In-preview action buttons — exact verb-phrase labels, equal heights,
    low-radius controls (3px) inside 4px artifact shells (directive 48). */
export function MockBtn({
  kind,
  children,
}: {
  kind: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  if (kind === "primary") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-[var(--text-primary)] px-3 text-[12.5px] font-semibold text-[var(--canvas)]">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        {children}
      </span>
    );
  }
  if (kind === "secondary") {
    return (
      <span className="inline-flex h-8 items-center rounded-[3px] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12.5px] font-semibold text-[var(--text-secondary)]">
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 items-center px-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] underline decoration-[var(--border-contrast)] underline-offset-[3px]">
      {children}
    </span>
  );
}

/** Located source text — document-evidence treatment: an amber underline
    mark, not a highlighter block. Amber is reserved for source location. */
export function SourceMark({ children }: { children: ReactNode }) {
  return (
    <mark className="border-b-2 border-[color:color-mix(in_oklab,var(--warning-ink)_80%,transparent)] bg-transparent font-semibold text-[var(--text-primary)]">
      {children}
    </mark>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Product preview shell — staged Oblixa app chrome (never generic browser
   chrome): workspace breadcrumb topbar, optional tab row, surface title bar,
   content, optional footer. Mock data, so aria-hidden.
   ──────────────────────────────────────────────────────────────────────────── */

/** Artifact role — inventory marker only (the shell surface is uniform;
    directive 13). */
export type PreviewVariant = "source" | "ledger" | "queue" | "access";

export function PreviewShell({
  variant = "queue",
  breadcrumb,
  tabs,
  activeTab,
  title,
  titleAction,
  children,
  footer,
  className = "",
}: {
  variant?: PreviewVariant;
  breadcrumb: string[];
  tabs?: readonly string[];
  activeTab?: string;
  title?: string;
  titleAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  /* Standardized header (design pass directive 68): the topbar carries the
     breadcrumb ONLY — per-preview metadata lives in the title row or the
     foot, never in the chrome. */
  return (
    <figure aria-hidden data-variant={variant} className={`lp-preview ${className}`.trim()}>
      <div className="lp-preview-topbar">
        <span className="min-w-0 truncate font-mono text-[12.5px] text-[var(--text-tertiary)]">
          {breadcrumb.map((seg, i) => (
            <Fragment key={seg}>
              {i > 0 ? <span className="mx-1 text-[color:color-mix(in_oklab,var(--text-tertiary)_60%,transparent)]">/</span> : null}
              <span className={i === breadcrumb.length - 1 ? "font-semibold text-[var(--text-secondary)]" : undefined}>
                {seg}
              </span>
            </Fragment>
          ))}
        </span>
      </div>
      {tabs ? (
        <div className="lp-preview-tabs">
          {tabs.map((tab) => (
            <span key={tab} className="lp-preview-tab" data-active={tab === activeTab ? "true" : undefined}>
              {tab}
            </span>
          ))}
        </div>
      ) : null}
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--border-subtle)] px-4 py-2">
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</span>
          {titleAction}
        </div>
      ) : null}
      {children}
      {footer}
    </figure>
  );
}

/** Quiet preview footer — standardized roles (design pass directive 67): LEFT is
    always the trust statement (optionally with the lock/file icon),
    RIGHT is always the workspace label — "Northwind workspace" on product
    previews, "Oblixa" on the pre-workspace access record. */
export function PreviewFoot({
  icon: Icon,
  label,
  meta,
}: {
  icon?: LucideIcon;
  label: string;
  /** Omit where a workspace label would be decorative (design pass directive 56). */
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,transparent)] px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
        {Icon ? <Icon className="h-3 w-3" strokeWidth={2.1} aria-hidden /> : null}
        {label}
      </span>
      {meta ? <span className="font-mono text-[11.5px] text-[var(--text-tertiary)]">{meta}</span> : null}
    </div>
  );
}

/* Preview density guardrail: no preview exceeds one header, one title row,
   three body rows, one selected state, one action, and one footer line —
   except the single primary capabilities artifact. Treat any future
   addition as content editing, not styling. */

/* Preview size tiers (design pass directive 54; design pass directive 65) — width drift is
   a defect class. Every artifact wrapper uses one of these, nothing else.
   hero: the dominant artifacts (hero + outcomes proof; deep right outdent).
   primary: the capabilities proof (outdents both sides).
   stage: follow-up sequence artifacts (capped, no outdent).
   board: the problem section's non-product evidence board.
   support: supporting records (access review) — column-capped and small. */

export const thClass = "px-3.5 py-2 text-left text-[12.5px] font-semibold text-[var(--text-secondary)]";
export const tdClass = "flex items-center px-3.5 py-[1.05rem] text-[15px] text-[var(--text-secondary)]";
/** Compact cell recipe for supporting tables (best-fit import) — same
    structure, quieter scale (design pass directive 46). */
export const tdTight = "flex items-center px-3.5 py-2.5 text-[14px] text-[var(--text-secondary)]";
export const rowRule = "border-t border-[var(--border-subtle)]";

/** Count metadata inside artifact chrome — sans tabular, not monospace
    (directive 18: mono is reserved for file names, citations, technical
    metadata). */
export const countMetaClass = "text-[12px] font-medium tabular-nums text-[var(--text-tertiary)]";
