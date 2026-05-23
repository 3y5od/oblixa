import { isValid } from "date-fns";
import { CheckCircle2, FileCheck2, Flag, Sparkles, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import {
  formatCalendarCompact,
  formatRelativeCompact,
} from "@/lib/ui-copy";

interface WorkspaceMilestonesProps {
  orgId: string;
}

interface Milestone {
  id: string;
  label: string;
  icon: LucideIcon;
  at: string;
}

const ACTIONS: Array<{ action: string; label: string; icon: LucideIcon }> = [
  { action: "contract.uploaded", label: "FIRST UPLOAD", icon: UploadCloud },
  { action: "extraction.completed", label: "FIRST EXTRACTION", icon: Sparkles },
  { action: "field.approved", label: "FIRST APPROVAL", icon: FileCheck2 },
  { action: "approval.completed", label: "FIRST SIGN-OFF", icon: CheckCircle2 },
];

export async function WorkspaceMilestones({ orgId }: WorkspaceMilestonesProps) {
  const admin = await getDashboardAdminClientCached();

  const results = await Promise.all(
    ACTIONS.map((a) =>
      admin
        .from("audit_events")
        .select("id, created_at")
        .eq("organization_id", orgId)
        .eq("action", a.action)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
    )
  );

  const milestones: Milestone[] = [];
  for (let i = 0; i < ACTIONS.length; i++) {
    const row = results[i]?.data as { id: string; created_at: string } | null;
    if (!row?.created_at) continue;
    milestones.push({
      id: row.id,
      label: ACTIONS[i]!.label,
      icon: ACTIONS[i]!.icon,
      at: row.created_at,
    });
  }

  if (milestones.length === 0) return null;

  return (
    <section aria-label="Workspace milestones">
      <CollapsibleSection
        storageKey="workspace-milestones"
        defaultOpen={false}
        header={
          <h2 className="inline-flex items-center gap-2 text-[1.125rem] font-semibold tracking-tight text-[var(--text-primary)]">
            <Flag className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
            Workspace milestones
          </h2>
        }
      >
        <ol
          className={`gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4 ${
            milestones.length === 1
              ? "flex max-w-md flex-wrap items-start"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`.trim()}
        >
        {milestones.map((m) => {
          const Icon = m.icon;
          const d = new Date(m.at);
          const dateChip = isValid(d) ? formatCalendarCompact(d) : "—";
          const relativeChip = isValid(d) ? formatRelativeCompact(d) : "";
          return (
            <li key={m.id} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))]"
              >
                <Icon
                  className="h-3.5 w-3.5 text-[var(--accent-strong)]"
                  strokeWidth={1.85}
                />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                  {m.label}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums text-[var(--text-secondary)]">
                    {dateChip}
                  </span>
                  {relativeChip ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
                      {relativeChip}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      </CollapsibleSection>
    </section>
  );
}
