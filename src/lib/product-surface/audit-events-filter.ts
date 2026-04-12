import type { WorkspaceProductMode } from "@/lib/product-surface/types";

type AuditEventRow = { action?: string | null; [key: string]: unknown };

/**
 * Strip audit stream rows that reference advanced/assurance modules for Core workspaces (§19).
 * Conservative prefix/substring match on `action`.
 */
export function filterAuditEventsForWorkspaceMode<T extends AuditEventRow>(
  rows: T[] | null | undefined,
  mode: WorkspaceProductMode
): T[] {
  if (!rows?.length || mode !== "core") return rows ?? [];

  return rows.filter((row) => {
    const raw = String(row.action ?? "").toLowerCase();
    if (!raw) return true;

    if (raw.startsWith("assurance.")) return false;
    if (raw.startsWith("campaign.")) return false;
    if (raw.startsWith("decision.")) return false;
    if (raw.includes("autopilot")) return false;
    if (raw.startsWith("finding.")) return false;
    if (raw.startsWith("playbook.")) return false;
    if (raw.startsWith("scorecard.")) return false;
    if (raw.startsWith("segment.")) return false;
    if (raw.includes("program_evolution")) return false;
    if (raw.includes("control_policy")) return false;
    if (raw.startsWith("v6_")) return false;
    if (raw.includes("review_board")) return false;

    return true;
  });
}
