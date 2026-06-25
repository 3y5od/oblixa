import { DataFooter } from "@/components/ui/data-footer";
import { buildEvidenceHref } from "@/lib/evidence/model";
import { EVIDENCE_ROW_LABELS } from "@/lib/evidence/spec-strings";
import type { EvidencePageModel, EvidenceRow } from "@/lib/evidence/types";
import { EvidenceCard } from "./evidence-card";
import { EVIDENCE_BODY_CELL, EvidenceTableRow } from "./evidence-table-row";

const EVIDENCE_HEADER_CELL =
  "px-3 py-2 text-left text-[10.5px] ui-caps-2 text-[var(--text-tertiary)] whitespace-nowrap";

export function EvidenceTable({
  rows,
  mutationsEnabled,
}: {
  rows: EvidenceRow[];
  mutationsEnabled: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)]">
      <ul className="min-w-0 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_72%,transparent)] md:hidden">
        {rows.map((row) => (
          <EvidenceCard key={row.id} row={row} mutationsEnabled={mutationsEnabled} />
        ))}
      </ul>
      <table className="hidden w-full table-fixed border-collapse text-[12.5px] md:table" aria-label="Evidence requests in this workspace">
        <thead className="bg-[color:color-mix(in_oklab,var(--surface-muted)_64%,var(--surface-raised))]">
          <tr className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
            {/* The request record is the dominant object: the parchment zone now
                carries the requirement ("Proof for …"), the request name, the
                contract, AND the lifecycle rail, so it takes the widest column and
                the standalone Requirement column is retired (its weight moved into
                the record masthead). */}
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[38%] pl-5 pr-4`}>
              <span className="inline-flex items-center gap-1.5">
                {EVIDENCE_ROW_LABELS.requestTitle}
                <span className="font-normal normal-case tracking-normal text-[var(--text-tertiary)]">
                  {"·"} requirement {"·"} progress
                </span>
              </span>
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} hidden w-[11%] pl-4 md:table-cell`}>
              {EVIDENCE_ROW_LABELS.requestOwner}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[9%]`}>
              {EVIDENCE_ROW_LABELS.dueDate}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[12%]`}>
              {EVIDENCE_ROW_LABELS.status}
            </th>
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} hidden w-[6%] 2xl:table-cell`}>
              Updated
            </th>
            {/* Consequence + next action: the cool decision pane. Header names the
                stake-and-action zone so a screen-reader user hears why this column
                carries both the consequence line and the primary verb. */}
            <th scope="col" className={`${EVIDENCE_HEADER_CELL} w-[13.5rem] pl-4 pr-5`}>
              Consequence and next action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <EvidenceTableRow key={row.id} row={row} mutationsEnabled={mutationsEnabled} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceFooterSummary({ model }: { model: EvidencePageModel }) {
  const sectionLabel = model.sections.find((section) => section.active)?.label ?? "this view";
  const { page, totalPages, totalInSection } = model.pageInfo;
  const latestUpdate = model.rows.reduce<string | null>((latest, row) => {
    if (!row.lastUpdateAt) return latest;
    if (!latest || row.lastUpdateAt > latest) return row.lastUpdateAt;
    return latest;
  }, null);
  return (
    <DataFooter
      shown={model.rows.length}
      total={totalInSection}
      sectionLabel={sectionLabel}
      filtered={model.hasActiveFilters}
      pagination={{
        page,
        totalPages,
        hrefFor: (target) => buildEvidenceHref({ section: model.activeSection, filters: model.filters, page: target }),
      }}
      lastUpdate={latestUpdate}
    />
  );
}

export { EVIDENCE_BODY_CELL };
