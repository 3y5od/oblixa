import { CircleAlert } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";

export function CoreDashboardPlanBanner() {
  return (
    <div
      role="status"
      className="ui-alert-warning flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: "color-mix(in oklab, var(--warning-ink) 30%, var(--border-card))",
            background: "color-mix(in oklab, var(--warning-ink) 14%, var(--surface-raised))",
            color: "var(--warning-ink)",
          }}
        >
          <CircleAlert className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug">Subscription required</p>
          <p className="mt-0.5 text-[12px] leading-snug">
            Creating or editing contracts needs an active subscription.
          </p>
        </div>
      </div>
      <ActionChip
        verb="Manage billing"
        href="/settings/billing"
        tone="warning"
        className="shrink-0 self-start sm:self-center"
      />
    </div>
  );
}
