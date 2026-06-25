import { Download, FileText, RotateCcw } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { STATUS_ICON, statusToSemantic } from "@/components/reports/report-display";
import type { ReportExportRun } from "@/lib/reports/types";

const COLUMNS = ["Report", "Rows", "Exported by", "Exported at", "Status", ""] as const;
const GRID_TEMPLATE = "minmax(0,1.25fr) 3rem minmax(0,7rem) 6.5rem 6.5rem auto";

/**
 * "Recent exports" run history for the Core exports card.
 *
 * A labeled mini-grid (report + scope/format · rows · who · when · status ·
 * re-export) so report-run history reads as a structured ledger, not a
 * repetitive list. Lives directly under the preview so it stays attached to the
 * report it summarizes. Each run re-exports with its original report + filters —
 * a completed run offers "Download", a failed run offers "Retry".
 */
export function ReportExportHistory({ runs }: { runs: ReportExportRun[] }) {
  const groups = groupRuns(runs);
  return (
    <div className="border-t border-[var(--border-subtle)] px-5 py-4">
      <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
          Recent exports
        </h3>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_28%,var(--surface-raised))] px-4 py-5">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
          >
            <FileText className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">No exports yet</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
              Export this report to create a downloadable CSV.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div
            className="ui-table-header hidden gap-x-4 px-1 pb-2 text-[10px] lg:grid"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map((column, index) => (
              <span key={column || `col-${index}`} className="min-w-0 truncate">
                {column}
              </span>
            ))}
          </div>

          <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)]">
            {groups.map((group, index) => {
              const run = group.latest;
              const semantic = statusToSemantic(run.status);
              const Icon = STATUS_ICON[semantic];
              const phase = classifyRunPhase(run.status);
              // Only show a format token that differs from the CSV default, so a
              // column of identical "· CSV" markers doesn't manufacture repetition.
              const formatToken =
                run.format && run.format.toLowerCase() !== "csv" ? run.format.toUpperCase() : "";
              const metaTokens = [...run.scope, formatToken].filter(Boolean);
              return (
                <div
                  key={`${run.reportKey}-${run.at ?? index}`}
                  className="flex flex-col gap-2 px-1 py-2.5 lg:grid lg:items-center lg:gap-x-4"
                  style={{ gridTemplateColumns: GRID_TEMPLATE }}
                >
                  <div className="min-w-0">
                    <p
                      className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]"
                      title={run.reportLabel}
                    >
                      <span className="truncate">{run.reportLabel}</span>
                      {group.count > 1 ? (
                        <span
                          className="inline-flex shrink-0 items-center rounded-[4px] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums text-[var(--text-tertiary)]"
                          title={`${group.count} exports of this report and scope`}
                        >
                          ×{group.count}
                        </span>
                      ) : null}
                    </p>
                    {metaTokens.length > 0 ? (
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] tabular-nums">
                        {metaTokens.map((token, tokenIndex) => (
                          <span key={token}>
                            {tokenIndex > 0 ? (
                              <span className="ui-dot-sep" aria-hidden>
                                ·
                              </span>
                            ) : null}
                            {token}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Rows</p>
                    <span className="font-mono text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                      {run.rows != null ? run.rows : "—"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Exported by</p>
                    <span
                      className="block truncate text-[12.5px] text-[var(--text-secondary)]"
                      title={run.exportedBy || undefined}
                    >
                      {run.exportedBy || "—"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Exported at</p>
                    {run.atLabel ? (
                      <time
                        dateTime={run.at ?? undefined}
                        title={run.at ?? undefined}
                        className="block truncate font-mono text-[11.5px] tabular-nums text-[var(--text-tertiary)]"
                      >
                        {run.atLabel}
                      </time>
                    ) : (
                      <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Status</p>
                    <StatusBadge status={semantic} className="gap-1">
                      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
                      {labelizeStatus(run.status)}
                    </StatusBadge>
                  </div>

                  <div className="lg:justify-self-end">
                    {/* Completed runs offer "Download" (re-emits the report);
                        failed/expired runs offer "Retry"; an in-flight run shows a
                        non-actionable progress marker rather than a dead link. */}
                    {phase === "processing" ? (
                      <span className="ui-caps-3 inline-flex items-center text-[10px] text-[var(--text-tertiary)]">
                        In progress
                      </span>
                    ) : (
                      <ActionChip
                        verb={phase === "failed" ? "Retry" : "Download"}
                        href={run.href}
                        icon={phase === "failed" ? RotateCcw : Download}
                        tone={phase === "failed" ? "danger" : undefined}
                        className="text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function labelizeStatus(status: string): string {
  const token = status.trim();
  if (!token) return "Completed";
  return token.charAt(0).toUpperCase() + token.slice(1).replace(/_/g, " ");
}

/**
 * Collapse an arbitrary stored job status into the three run phases the action
 * column understands: a terminal failure (offer Retry), an in-flight run (no
 * action yet), or a completed run (offer Download).
 */
function classifyRunPhase(status: string): "completed" | "failed" | "processing" {
  const s = status.toLowerCase();
  if (/fail|error|expired|cancel|reject/.test(s)) return "failed";
  if (/process|pending|queue|running|progress|started/.test(s)) return "processing";
  return "completed";
}

type RunGroup = { latest: ReportExportRun; count: number };

/**
 * Group export runs by what was exported (report + scope + format) so repeated
 * re-runs of the same report collapse to one row. Within each group the latest
 * run (by ISO `at`) is the representative; the group size becomes the run count.
 * First-seen group order is preserved, so the freshest exports stay on top.
 */
function groupRuns(runs: ReportExportRun[]): RunGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, ReportExportRun[]>();
  for (const run of runs) {
    const key = `${run.reportKey}|${run.scope.join(",")}|${run.format ?? ""}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(run);
    } else {
      buckets.set(key, [run]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const bucket = buckets.get(key)!;
    const latest = bucket.reduce(
      (best, run) => ((run.at ?? "") > (best.at ?? "") ? run : best),
      bucket[0]!
    );
    return { latest, count: bucket.length };
  });
}
