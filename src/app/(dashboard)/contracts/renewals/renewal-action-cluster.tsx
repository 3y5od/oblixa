import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Plus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { RenewalRowActionsMenu } from "@/components/renewals/renewal-row-actions-menu";
import {
  RENEWAL_SECONDARY_ACTION_LABELS,
} from "@/lib/renewals/spec-strings";
import type { RenewalActionCapability } from "@/lib/renewals/types";
import type { RenewalFormAction } from "./renewals-page-types";

const RENEWAL_ACTION_ICON: Record<string, LucideIcon> = {
  mark_reviewed: Eye,
  create_renewal_task: Plus,
  complete: CheckCircle2,
  reopen: RotateCcw,
  export_renewal_report: Download,
  open_contract: ExternalLink,
};

export function RenewalActionCluster({
  actions,
  canMutate,
  returnTo,
  contractTitle,
  contractHref,
  updateRenewalAction,
}: {
  actions: RenewalActionCapability[];
  canMutate: boolean;
  returnTo: string;
  contractTitle: string;
  contractHref: string;
  updateRenewalAction: RenewalFormAction;
}) {
  const itemClass =
    "ui-chip-focus flex w-full items-center gap-2 rounded-[0.45rem] px-2.5 py-1.5 text-left text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] hover:text-[var(--text-primary)]";
  const iconSlot = (key: string) => {
    const Icon = RENEWAL_ACTION_ICON[key];
    return (
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> : null}
      </span>
    );
  };
  return (
    <RenewalRowActionsMenu contractTitle={contractTitle}>
      <Link href={contractHref} role="menuitem" tabIndex={-1} className={itemClass}>
        {iconSlot("open_contract")}
        {RENEWAL_SECONDARY_ACTION_LABELS.open_contract}
      </Link>
      {actions.map((action) => {
        if (action.kind === "mutation" && canMutate && action.checkpointId && action.mutation) {
          return (
            <form key={action.key} action={updateRenewalAction}>
              <input type="hidden" name="checkpointId" value={action.checkpointId} />
              <input
                type="hidden"
                name="status"
                value={action.mutation === "reopen_checkpoint" ? "pending" : "completed"}
              />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" role="menuitem" tabIndex={-1} className={itemClass}>
                {iconSlot(action.key)}
                {action.label}
              </button>
            </form>
          );
        }
        return (
          <Link key={action.key} href={action.href ?? "/renewals"} role="menuitem" tabIndex={-1} className={itemClass}>
            {iconSlot(action.key)}
            {action.label}
          </Link>
        );
      })}
      {!canMutate ? (
        <span className="px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)]">
          Editing requires contract access
        </span>
      ) : null}
    </RenewalRowActionsMenu>
  );
}
