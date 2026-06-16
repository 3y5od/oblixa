import Link from "next/link";
import type { SettingsStatusTone } from "@/lib/workspace-settings-model";
import { SettingsAnchorLink } from "./settings-anchor-link";
import { ROW_HOVER } from "./settings-directory-sections";

type SnapshotCell = {
  key: string;
  label: string;
  value: string;
  tabular?: boolean;
  tone?: SettingsStatusTone;
  href?: string;
};

function SnapshotCellBody({ cell }: { cell: SnapshotCell }) {
  return (
    <>
      <dt className="ui-caps-3 text-[10px] text-[var(--text-tertiary)]">{cell.label}</dt>
      <dd
        className={`text-[13px] font-semibold ${cell.tabular ? "tabular-nums" : ""} ${
          cell.tone === "attention" ? "text-[var(--warning-ink)]" : "text-[var(--text-primary)]"
        }`}
      >
        {cell.value}
      </dd>
    </>
  );
}

const SNAPSHOT_CELL_BASE =
  "flex items-baseline justify-between gap-3 px-4 py-2.5 sm:flex-1 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5";

export function SettingsSnapshot({
  memberCount,
  pendingInviteCount,
  billingLabel,
  billingTone,
  billingHref,
  teamHref = "#team-access",
}: {
  memberCount: number;
  pendingInviteCount: number;
  billingLabel: string;
  billingTone?: SettingsStatusTone;
  billingHref?: string;
  teamHref?: string;
}) {
  const cells: SnapshotCell[] = [
    { key: "members", label: "Workspace members", value: String(memberCount), tabular: true, href: teamHref },
    {
      key: "invites",
      label: "Pending invites",
      value: pendingInviteCount === 0 ? "None" : String(pendingInviteCount),
      tabular: pendingInviteCount > 0,
      href: teamHref,
    },
    { key: "billing", label: "Billing access", value: billingLabel, tone: billingTone, href: billingHref },
  ];
  return (
    <section aria-label="Workspace administration">
      <p className="ui-caps-1 mb-1.5 text-[11px] text-[var(--text-tertiary)]">Workspace administration</p>
      <dl className="ui-card flex flex-col divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] p-0 sm:flex-row sm:divide-x sm:divide-y-0">
        {cells.map((cell) => {
          if (!cell.href) {
            return (
              <div key={cell.key} className={SNAPSHOT_CELL_BASE}>
                <SnapshotCellBody cell={cell} />
              </div>
            );
          }
          const linkClass = `group ui-chip-focus relative transition-colors ${SNAPSHOT_CELL_BASE} ${ROW_HOVER}`;
          return cell.href.startsWith("#") ? (
            <SettingsAnchorLink key={cell.key} href={cell.href as `#${string}`} className={linkClass}>
              <SnapshotCellBody cell={cell} />
            </SettingsAnchorLink>
          ) : (
            <Link key={cell.key} href={cell.href} className={linkClass}>
              <SnapshotCellBody cell={cell} />
            </Link>
          );
        })}
      </dl>
    </section>
  );
}
