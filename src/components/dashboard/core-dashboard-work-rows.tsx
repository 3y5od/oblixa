import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { EntityChip } from "@/components/ui/entity-chip";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatTone } from "@/components/ui/stat-cell";
import { TimeChip } from "@/components/ui/time-chip";
import { createElement } from "react";
import type { CoreDashboardWorkRow } from "@/lib/dashboard/core-dashboard-model";
import { EMAIL_RE, MetaDataFlag } from "./core-dashboard-data-flags";
import {
  sanitizeWorkTitle,
  statusForWork,
  workHoverVerb,
  workStatusInk,
  workStatusLabel,
  workTypeIcon,
  workTypeLabel,
} from "./core-dashboard-work-format";

export function WorkRows({ rows }: { rows: CoreDashboardWorkRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => (
        <WorkRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function WorkRow({ row }: { row: CoreDashboardWorkRow }) {
  const contractSuffix = row.contractTitle ? `: ${row.contractTitle}` : "";
  const strippedTitle =
    contractSuffix && row.title.endsWith(contractSuffix)
      ? row.title.slice(0, -contractSuffix.length)
      : row.title;
  const cleanTitle = sanitizeWorkTitle(strippedTitle);
  const typeLabel = workTypeLabel(row.type);
  const statusLabel = workStatusLabel(row);
  const status = statusForWork(row);
  const ink = workStatusInk(status);
  const isDanger = status === "blocked" || status === "overdue" || row.dueState === "overdue";
  const dueTone: StatTone | undefined = row.dueState === "overdue" ? "danger" : undefined;

  return (
    <li>
      <DashboardActionRow
        href={row.href}
        rail={isDanger ? "danger" : undefined}
        hoverAction={workHoverVerb(row)}
        leading={
          <span
            role="img"
            aria-label={typeLabel}
            title={typeLabel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{
              background: isDanger
                ? `color-mix(in oklab, ${ink} 14%, var(--surface))`
                : "color-mix(in oklab, var(--surface-muted) 65%, var(--surface))",
              color: isDanger ? ink : "var(--text-tertiary)",
            }}
          >
            {createElement(workTypeIcon(row.type), {
              className: "h-3.5 w-3.5",
              strokeWidth: 1.85,
            })}
          </span>
        }
        title={
          <p title={cleanTitle} className="line-clamp-2 text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
            {cleanTitle}
          </p>
        }
        meta={<WorkRowMeta row={row} status={status} statusLabel={statusLabel} typeLabel={typeLabel} />}
        trailing={
          row.dueAt ? (
            <TimeChip date={row.dueAt} format="calendar" tone={dueTone} className="shrink-0" bordered />
          ) : (
            <span aria-hidden className="inline-block w-[3.75rem] shrink-0" />
          )
        }
      />
    </li>
  );
}

function WorkRowMeta({
  row,
  status,
  statusLabel,
  typeLabel,
}: {
  row: CoreDashboardWorkRow;
  status: ReturnType<typeof statusForWork>;
  statusLabel: string;
  typeLabel: string;
}) {
  const workOwnerText = row.ownerLabel?.trim() || "";
  const workOwnerIsEmail = Boolean(workOwnerText) && EMAIL_RE.test(workOwnerText);

  return (
    <p className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
      <StatusBadge status={status} className="self-center">
        {statusLabel}
      </StatusBadge>
      <span className="ui-caps-3 self-center text-[10px] text-[var(--text-tertiary)]">
        {typeLabel}
      </span>
      {row.contractTitle ? <EntityChip name={row.contractTitle} className="max-w-[10rem] sm:max-w-[14rem]" /> : null}
      {workOwnerText ? (
        workOwnerIsEmail ? (
          <MetaDataFlag kind="owner" raw={workOwnerText} />
        ) : (
          <span className="self-center truncate text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">Owner:</span> {workOwnerText}
          </span>
        )
      ) : (
        <span className="self-center text-[var(--text-tertiary)]">Unassigned</span>
      )}
    </p>
  );
}
