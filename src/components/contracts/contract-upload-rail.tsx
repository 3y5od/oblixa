import Link from "next/link";
import { ArrowRight, Table2 } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { CreationPipeline } from "@/components/contracts/creation-pipeline";
import { RecentUploads, type RecentFileRow } from "@/components/contracts/recent-uploads";

/** Post-upload journey shown beside the editor — quiet wayfinding, not actions
 *  the user takes on this page. Each step carries a short qualifier chip. */
const STEPS: ReadonlyArray<{ label: string; chip: string }> = [
  { label: "Confirm suggested details", chip: "Source-backed" },
  { label: "Assign ownership", chip: "Owners" },
  { label: "Track dates and tasks", chip: "Dates & tasks" },
];

export interface UploadRailRecovery {
  tone: "warning" | "info";
  title: string;
  body: string;
  action?: { label: string; href: string };
}

export interface ContractUploadRailProps {
  recentFiles: RecentFileRow[];
  /** Rendered first when the workspace can't create the record (viewer / no
   *  active plan) — a tone-tinted callout with a structured recovery action. */
  recovery?: UploadRailRecovery;
}

function RecoveryCallout({ recovery }: { recovery: UploadRailRecovery }) {
  const ink = recovery.tone === "warning" ? "var(--warning-ink)" : "var(--info-ink)";
  const soft = recovery.tone === "warning" ? "var(--warning-soft)" : "var(--info-soft)";
  return (
    <section
      className="rounded-xl border p-3.5"
      style={{
        borderColor: `color-mix(in oklab, ${ink} 28%, var(--border-card))`,
        background: `color-mix(in oklab, ${soft} 30%, var(--surface-raised))`,
      }}
    >
      <p
        className="ui-caps-2 text-[10.5px] leading-none"
        style={{ color: ink }}
      >
        {recovery.title}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-secondary)]">
        {recovery.body}
      </p>
      {recovery.action ? (
        <Link
          href={recovery.action.href}
          className="mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
          style={{
            borderWidth: 1,
            borderColor: `color-mix(in oklab, ${ink} 36%, var(--border-card))`,
            background: `color-mix(in oklab, ${ink} 12%, var(--surface-raised))`,
            color: ink,
          }}
        >
          {recovery.action.label}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/**
 * The `/contracts/new` context rail: post-upload stepper, recent uploads, and a
 * compact import-existing-tracker callout — flat grouped lists separated by
 * hairlines (no nested cards), quieter than the editor it sits beside.
 */
export function ContractUploadRail({ recentFiles, recovery }: ContractUploadRailProps) {
  return (
    <div className="ui-card-quiet flex flex-col gap-5 rounded-2xl p-4">
      {recovery ? <RecoveryCallout recovery={recovery} /> : null}

      <section>
        <p className="ui-eyebrow">After upload</p>
        <CreationPipeline steps={STEPS} className="mt-3" />
      </section>

      <section className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
        <RecentUploads files={recentFiles} />
      </section>

      <section className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
        <div className="flex items-center gap-2">
          <Table2
            className="h-4 w-4 shrink-0 text-[var(--accent-strong)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <p className="ui-caps-2 text-[10.5px] leading-none text-[var(--accent-strong)]">
            Import existing tracker
          </p>
        </div>
        <ActionChip
          verb="Import contracts"
          href="/contracts/bulk"
          className="mt-2.5 w-full justify-between"
        />
      </section>
    </div>
  );
}
