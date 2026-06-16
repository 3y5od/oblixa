import { Fragment } from "react";
import { FileText, Lock } from "lucide-react";
import { StatusBadge, type SemanticStatus } from "@/components/ui/status-badge";
import {
  countMetaClass,
  MockBtn,
  OwnerAvatar,
  PreviewFoot,
  PreviewShell,
  rowRule,
  selectedRowClass,
  SelectedBar,
  SourceMark,
  tdClass,
  thClass,
} from "@/components/landing/landing-preview-shared";

export function HeroPreview() {
  /* One message (directives 1, 5-8): the cited clause produces ONE suggested
     detail. Two panes, one amber mark, one highlight, one action. */
  return (
    <PreviewShell
      variant="source"
      breadcrumb={["Northwind workspace", "Contract review"]}
      title="Contract Details Review"
      titleAction={
        <span className={countMetaClass}>4 contracts need review</span>
      }
      footer={
        <PreviewFoot icon={Lock} label="Suggestions are not used for reminders or reports until your team confirms them." meta="Northwind workspace" />
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:divide-x lg:divide-[var(--border-subtle)]">
        {/* Source pane — the signed page itself, on paper; the quoted clause
            is the dominant object (directive 7). */}
        <div className="border-b border-[var(--border-subtle)] lg:border-b-0">
          <p className="flex items-center gap-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_60%,var(--surface-raised))] px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)]">
            <FileText className="h-3 w-3" strokeWidth={2} aria-hidden />
            Source text · Northwind_MSA.pdf · p. 14
          </p>
          <div className="flex h-full flex-col justify-center bg-[color:color-mix(in_oklab,var(--surface-inset)_45%,var(--surface-raised))] px-6 py-5">
            <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Article 9 · Term and termination
            </p>
            <p className="lp-serif relative mt-3.5 text-[17px] font-normal leading-[1.75] text-[var(--text-primary)]">
              <span
                aria-hidden
                className="absolute -left-3.5 top-[0.35em] h-[1.1em] w-[3px] bg-[var(--warning-ink)]"
              />
              <span className="mr-2 font-mono text-[10.5px] text-[var(--text-tertiary)]">9.2</span>
              Termination. Either party may terminate by providing{" "}
              <SourceMark>sixty (60) days</SourceMark> written notice prior to the renewal date.
            </p>
            <p className="mt-4 text-center font-mono text-[10.5px] tracking-[0.18em] text-[var(--text-tertiary)]">
              — 14 —
            </p>
          </div>
        </div>

        {/* Detail pane — the one suggested detail this clause produces. */}
        <div className="flex min-w-0 flex-col bg-[color:color-mix(in_oklab,var(--surface-cool)_60%,var(--surface-raised))]">
          <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-4 py-2">
            <span className="text-[12.5px] font-semibold text-[var(--text-secondary)]">
              Suggested detail
            </span>
            <StatusBadge status="in_review" className="text-[10.5px]">
              Suggested
            </StatusBadge>
          </div>
          <div className="flex-1 px-4 py-4">
            <div className={`${selectedRowClass} px-4 py-4`}>
              <SelectedBar />
              <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
                Notice window
              </p>
              <p className="mt-1.5 text-[30px] font-semibold leading-none text-[var(--text-primary)]">
                60 days
              </p>
              <p className="mt-3 font-mono text-[12px] tabular-nums text-[var(--warning-ink)]">
                from p. 14 · §9.2 Termination
              </p>
            </div>
          </div>
          {/* Compact confirmation footer — action and owner on one aligned
              row (directive 4). */}
          <div className="flex items-center justify-between gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-4 py-3">
            <MockBtn kind="primary">Confirm detail</MockBtn>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
              Owner
              <OwnerAvatar initials="PR" />
              <span className="font-medium text-[var(--text-primary)]">Priya Raman</span>
            </span>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Problem artifact — the manual tracker, deliberately flat, dashed, and
   incomplete, but readable. Each fragment carries the index of the failure
   row it stages, so the ledger and the scene read as one map.
   ──────────────────────────────────────────────────────────────────────────── */


export function DetailsReviewPreview() {
  return (
    <PreviewShell
      variant="source"
      breadcrumb={["Northwind workspace", "Contract review"]}
      title="Contract Details Review"
      titleAction={
        <span className={countMetaClass}>4 contracts need review</span>
      }
      className="lg:flex lg:h-full lg:flex-col"
      footer={
        <PreviewFoot label="Suggestions are not used for reminders or reports until your team confirms them." meta="Northwind workspace" />
      }
    >
      {/* Two-pane inspection, equal weight: the clause on paper, the
          suggested detail and its consequence beside it. */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:divide-x lg:divide-[var(--border-subtle)]">
        <div className="flex flex-col border-b border-[var(--border-subtle)] lg:border-b-0">
          <p className="flex items-center gap-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_60%,var(--surface-raised))] px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)]">
            <FileText className="h-3 w-3" strokeWidth={2} aria-hidden />
            Source text · p. 14 · §2.1
          </p>
          {/* The clause centers in the pane; the locator holds the bottom
              line with clear separation from the foot (design pass directives
              25-26). */}
          <div className="flex min-h-0 flex-1 flex-col bg-[color:color-mix(in_oklab,var(--surface-inset)_45%,var(--surface-raised))] px-5 py-4">
            <p className="lp-serif relative my-auto text-[14.5px] font-normal leading-[1.75] text-[var(--text-secondary)]">
              <span
                aria-hidden
                className="absolute -left-3 top-[0.35em] h-[1.1em] w-[3px] bg-[var(--warning-ink)]"
              />
              <span className="mr-2 font-mono text-[10.5px] text-[var(--text-tertiary)]">2.1</span>
              The Initial Term shall commence on <SourceMark>March 12, 2024</SourceMark> and
              continue for an initial term of three (3) years…
            </p>
            <p className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5 font-mono text-[11.5px] tabular-nums text-[var(--text-tertiary)]">
              suggested renewal date · calculated from §2.1
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col bg-[color:color-mix(in_oklab,var(--surface-cool)_48%,var(--surface-raised))]">
          <div className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold text-[var(--text-secondary)]">
                  Renewal date
                </p>
                <p className="mt-0.5 text-[19px] font-semibold tabular-nums text-[var(--text-primary)]">
                  March 12, 2027
                </p>
              </div>
              <StatusBadge status="in_review" className="text-[10.5px]">
                Suggested
              </StatusBadge>
            </div>
            <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
              Once confirmed, this date creates reminders, tasks, and reports.
            </p>
          </div>
          <div className="mt-auto border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-4 py-3">
            <MockBtn kind="primary">Confirm detail</MockBtn>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}


export function InspectionPreview() {
  const rows: Array<{
    detail: string;
    value: string;
    source: string;
    status: SemanticStatus;
    statusLabel: string;
    action?: string;
    selected?: boolean;
  }> = [
    {
      detail: "Renewal date",
      value: "March 12, 2027",
      source: "p. 14 · §2.1",
      status: "in_review",
      statusLabel: "Suggested",
      action: "Confirm detail",
      selected: true,
    },
    {
      detail: "Notice window",
      value: "60 days",
      source: "p. 14 · §9.2",
      status: "healthy",
      statusLabel: "Confirmed",
    },
    {
      detail: "Owner",
      value: "Priya Raman",
      source: "tracker.csv",
      status: "healthy",
      statusLabel: "Confirmed",
    },
  ];
  return (
    <PreviewShell
      variant="source"
      breadcrumb={["Northwind workspace", "Contract review"]}
      title="Contract Details Review"
      titleAction={
        <span className={countMetaClass}>
          4 contracts need review
        </span>
      }
      footer={
        <PreviewFoot icon={Lock} label="Suggestions are not used for reminders or reports until your team confirms them." meta="Northwind workspace" />
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:divide-x lg:divide-[var(--border-subtle)]">
        {/* Source pane — the clause the suggestion came from; the measure
            stays contract-page narrow (design pass directive 31), and the paper
            ground runs the full pane height. */}
        <div className="flex flex-col border-b border-[var(--border-subtle)] lg:border-b-0">
          {/* Source label row matches the hero/stage treatment exactly
              (design pass directive 14). */}
          <p className="flex items-center gap-1.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-inset)_60%,var(--surface-raised))] px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)]">
            <FileText className="h-3 w-3" strokeWidth={2} aria-hidden />
            Source text · p. 14 · §2.1
          </p>
          {/* The clause group centers in the paper so the pane carries no
              dead lower area (design pass directive 26). */}
          <div className="flex flex-1 flex-col justify-center bg-[color:color-mix(in_oklab,var(--surface-inset)_45%,var(--surface-raised))] px-5 py-4">
            <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Article 2 · Term
            </p>
            <p className="lp-serif relative mt-3 max-w-[33rem] text-[15px] font-normal leading-[1.75] text-[var(--text-secondary)]">
              <span
                aria-hidden
                className="absolute -left-3.5 top-[0.35em] h-[1.1em] w-[3px] bg-[var(--warning-ink)]"
              />
              <span className="mr-2 font-mono text-[10.5px] text-[var(--text-tertiary)]">2.1</span>
              The Initial Term shall commence on <SourceMark>March 12, 2024</SourceMark> and
              continue for an initial term of three (3) years, renewing automatically for
              successive one (1) year terms unless either party gives written notice of
              non-renewal.
            </p>
            <p className="mt-4 text-center font-mono text-[10.5px] tracking-[0.18em] text-[var(--text-tertiary)]">
              — 14 —
            </p>
          </div>
        </div>

        {/* Record pane — the detail ledger and where it is used. */}
        <div className="flex min-w-0 flex-col bg-[color:color-mix(in_oklab,var(--surface-cool)_42%,var(--surface-raised))]">
          <div className="grid grid-cols-[1fr_1fr_0.9fr] md:grid-cols-[0.85fr_1fr_0.75fr_0.95fr]">
            <span className={thClass}>Detail</span>
            <span className={thClass}>Suggested value</span>
            <span className={`${thClass} hidden md:block`}>Source</span>
            <span className={thClass}>Status</span>
            {rows.map((r) => {
              const sel = r.selected ? selectedRowClass : "";
              return (
                <Fragment key={r.detail}>
                  <span className={`${tdClass} ${rowRule} ${sel} font-semibold text-[var(--text-primary)]`}>
                    {r.selected ? <SelectedBar /> : null}
                    {r.detail}
                  </span>
                  <span className={`${tdClass} ${rowRule} ${sel} tabular-nums`}>{r.value}</span>
                  <span className={`${tdClass} ${rowRule} ${sel} hidden font-mono !text-[11.5px] md:flex`}>
                    {r.source}
                  </span>
                  <span className={`${tdClass} ${rowRule} ${sel}`}>
                    <StatusBadge status={r.status} className="text-[10.5px]">
                      {r.statusLabel}
                    </StatusBadge>
                  </span>
                </Fragment>
              );
            })}
          </div>
          <div className="mt-auto border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-4 py-3">
            <MockBtn kind="primary">Confirm detail</MockBtn>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

/* The source→follow-up chain now lives ONCE, as the outcomes thesis rail
   (design pass directive 29) — the capabilities diagram is removed so the section's
   single proof is the cleanest artifact on the page. */

/* ────────────────────────────────────────────────────────────────────────────
   Outcomes preview — operational attention: dominant scoped counts beside
   the queue that explains the selected count, plus the export trail.
   ──────────────────────────────────────────────────────────────────────────── */
