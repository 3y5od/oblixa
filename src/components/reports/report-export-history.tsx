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
  return (
    <div className="border-t border-[var(--border-subtle)] px-5 py-4">
      <p className="ui-caps-2 mb-2.5 text-[10.5px] text-[var(--text-tertiary)]">Recent exports</p>

      {runs.length === 0 ? (
        <p className="text-[12.5px] leading-snug text-[var(--text-tertiary)]">
          No exports yet. Exported reports appear here with their status and time.
        </p>
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
            {runs.map((run, index) => {
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
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]" title={run.reportLabel}>
                      {run.reportLabel}
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
