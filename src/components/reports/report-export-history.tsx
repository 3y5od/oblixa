import { Download, RotateCcw } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { STATUS_ICON, statusToSemantic } from "@/components/reports/report-display";
import type { ReportExportRun } from "@/lib/reports/types";

const COLUMNS = ["Report", "Status", "Rows", "Exported", ""] as const;
const GRID_TEMPLATE = "minmax(0,1fr) 8rem 3.5rem 7rem auto";

/**
 * "Recent exports" run history for the Core exports card.
 *
 * A labeled mini-grid (report + scope/format · status · rows · time · action)
 * so report-run history reads as structured columns, not a repetitive list.
 * Lives directly under the preview in the right pane so it stays attached to the
 * report it summarizes. Each run re-exports with its original report + filters —
 * a completed run offers "Export", a failed run offers "Retry".
 */
export function ReportExportHistory({ runs }: { runs: ReportExportRun[] }) {
  // Collapse repeated exports of the same report + scope + format into one row,
  // so a burst of identical re-runs reads as a single grouped entry (the latest
  // run, prominent, with a run count) instead of a wall of duplicate lines.
  const groups = groupRuns(runs);
  return (
    <div className="border-t border-[var(--border-subtle)] px-5 py-4">
      <div className="mb-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="ui-caps-2 text-[10.5px] text-[var(--text-tertiary)]">Recent exports</p>
        <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
          Rows are the records included in that export run.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-3 py-1">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
          >
            <Download className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p className="ui-caps-2 text-[10.5px] text-[var(--text-secondary)]">No exports yet</p>
            <p className="ui-caps-3 mt-0.5 text-[9.5px] text-[var(--text-tertiary)]">
              Exported reports appear here
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div
            className="hidden gap-x-4 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] pb-2 lg:grid"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map((column, index) => (
              <span
                key={column || `col-${index}`}
                className="ui-caps-2 min-w-0 truncate text-[10px] text-[var(--text-tertiary)]"
              >
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
              // column of identical "· CSV" markers doesn't manufacture repetition
              // (exports are CSV-only today). Window scope still distinguishes
              // windowed runs.
              const formatToken =
                run.format && run.format.toLowerCase() !== "csv" ? run.format.toUpperCase() : "";
              const metaTokens = [...run.scope, formatToken].filter(Boolean);
              return (
                <div
                  key={`${run.reportKey}-${run.at ?? index}`}
                  className="flex flex-col gap-2 py-2.5 lg:grid lg:items-center lg:gap-x-4"
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
                          className="ui-caps-3 inline-flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] tabular-nums text-[var(--text-tertiary)]"
                          title={`${group.count} exports of this report and scope`}
                        >
                          ×{group.count}
                        </span>
                      ) : null}
                    </p>
                    {metaTokens.length > 0 ? (
                      <p className="ui-caps-3 mt-0.5 text-[9.5px] text-[var(--text-tertiary)] tabular-nums">
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
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Status</p>
                    <StatusBadge status={semantic} className="gap-1">
                      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
                      {labelizeStatus(run.status)}
                    </StatusBadge>
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Rows</p>
                    <span className="font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
                      {run.rows != null ? run.rows : "—"}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="ui-caps-3 mb-1 text-[var(--text-tertiary)] lg:hidden">Exported</p>
                    {run.atLabel ? (
                      <time
                        dateTime={run.at ?? undefined}
                        title={run.at ?? undefined}
                        className="block truncate font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]"
                      >
                        {run.atLabel}
                      </time>
                    ) : (
                      <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
                    )}
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
