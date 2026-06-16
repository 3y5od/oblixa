import Link from "next/link";
import { ArrowRight, Table2 } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { CreationPipeline } from "@/components/contracts/creation-pipeline";
import { RecentUploads, type RecentFileRow } from "@/components/contracts/recent-uploads";

/** Post-upload sequence shown beside the editor — quiet wayfinding, not actions
 *  the user takes on this page. Each step explains what it does and carries a
 *  real state condition, not a decorative category tag. */
const STEPS: ReadonlyArray<{ label: string; help: string; chip: string }> = [
  {
    label: "Review suggested details",
    help: "Check dates, owners, and terms against source text.",
    chip: "Not started",
  },
  {
    label: "Confirm ownership",
    help: "Assign the person responsible for reminders, tasks, evidence, and reports.",
    chip: "Owner required",
  },
  {
    label: "Track dates and tasks",
    help: "Confirmed dates can appear in renewal lists, tasks, and reports.",
    chip: "Available after review",
  },
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

/** A tone-tinted recovery band at the top of the rail. De-nested from the quiet
 *  card it sits in (§: no card-in-card): a flat tint band with a left tone rule
 *  instead of a fully bordered inner card, so it reads as an alert state rather
 *  than a stacked panel. */
function RecoveryCallout({ recovery }: { recovery: UploadRailRecovery }) {
  const ink = recovery.tone === "warning" ? "var(--warning-ink)" : "var(--info-ink)";
  const soft = recovery.tone === "warning" ? "var(--warning-soft)" : "var(--info-soft)";
  return (
    <section
      className="rounded-md border-l-2 px-3.5 py-3"
      style={{
        borderColor: ink,
        background: `color-mix(in oklab, ${soft} 28%, transparent)`,
      }}
    >
      <p className="text-[12px] font-semibold leading-none" style={{ color: ink }}>
        {recovery.title}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-secondary)]">
        {recovery.body}
      </p>
      {recovery.action ? (
        <Link
          href={recovery.action.href}
          className="mt-2.5 inline-flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-[12px] font-semibold transition-colors"
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
        <CreationPipeline heading="After this step" steps={STEPS} />
      </section>

      <section className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
        <RecentUploads files={recentFiles} />
      </section>

      <section className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5">
        <div className="flex items-center gap-2">
          <Table2
            className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <p className="text-[12px] font-medium leading-none text-[var(--text-primary)]">
            Import tracker rows
          </p>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">
          Use a UTF-8 CSV when your signed contracts are already tracked in a
          spreadsheet.
        </p>
        <ActionChip
          verb="Import contracts"
          href="/contracts/bulk"
          className="mt-2.5 w-full justify-between"
        />
      </section>
    </div>
  );
}
