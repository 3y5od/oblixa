import { DashboardActionRow } from "@/components/dashboard/dashboard-action-row";
import { ChipPair } from "@/components/ui/chip-pair";
import { TimeChip } from "@/components/ui/time-chip";
import type { CoreDashboardDeadlineRow } from "@/lib/dashboard/core-dashboard-model";
import { EMAIL_RE, MetaDataFlag } from "./core-dashboard-data-flags";

export function DeadlineRows({ rows }: { rows: CoreDashboardDeadlineRow[] }) {
  return (
    <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
      {rows.map((row) => (
        <DeadlineRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function DeadlineRow({ row }: { row: CoreDashboardDeadlineRow }) {
  const urgent = row.daysRemaining <= 7;
  const titleText = row.contractTitle?.trim() || row.label;
  const showEyebrow = Boolean(row.contractTitle?.trim());
  const countdown =
    row.daysRemaining === 0
      ? "Today"
      : `In ${row.daysRemaining} ${row.daysRemaining === 1 ? "day" : "days"}`;

  return (
    <li>
      <DashboardActionRow
        href={row.href}
        ariaLabel={`${row.label}: ${titleText}`}
        rail={urgent ? "warning" : undefined}
        hoverAction="Open contract"
        eyebrow={
          showEyebrow ? (
            <ChipPair
              primary={row.label}
              secondary={row.source === "derived" ? "Calculated" : "Confirmed"}
              tone={row.source === "derived" ? undefined : "success"}
            />
          ) : undefined
        }
        title={
          <p title={titleText} className="mt-0.5 truncate text-[13.5px] font-semibold leading-[1.3] tracking-tight text-[var(--text-primary)]">
            {titleText}
          </p>
        }
        meta={<DeadlineMeta row={row} />}
        trailing={
          <div className="flex flex-col items-end gap-1 text-right">
            <TimeChip date={row.date} format="calendar" tone={urgent ? "warning" : undefined} bordered className="min-w-[3.75rem] justify-center" />
            <span className="text-[10.5px] font-medium tabular-nums" style={{ color: urgent ? "var(--warning-ink)" : "var(--text-tertiary)" }}>
              {countdown}
            </span>
          </div>
        }
      />
    </li>
  );
}

function DeadlineMeta({ row }: { row: CoreDashboardDeadlineRow }) {
  return (
    <>
      {row.ownerLabel ? (
        EMAIL_RE.test(row.ownerLabel.trim()) ? (
          <p className="mt-0.5">
            <MetaDataFlag kind="owner" raw={row.ownerLabel} />
          </p>
        ) : (
          <p className="mt-0.5 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">Owner:</span> {row.ownerLabel}
          </p>
        )
      ) : null}
      {row.basis ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">{row.basis}</p>
      ) : null}
    </>
  );
}
