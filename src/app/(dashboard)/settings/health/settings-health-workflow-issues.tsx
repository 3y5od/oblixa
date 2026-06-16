import { OperationalQueueRow } from "@/components/ui/operational-summary-card";
import { statusLabel, type WorkspaceHealthItem } from "@/lib/workspace-health-model";
import type { SettingsHealthPageAction } from "./settings-health-page-model";
import { healthItemTone } from "./settings-health-status-utils";

type SettingsHealthWorkflowIssuesProps = {
  items: WorkspaceHealthItem[];
  primaryAction: SettingsHealthPageAction;
};

export function SettingsHealthWorkflowIssues({ items, primaryAction }: SettingsHealthWorkflowIssuesProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="ui-eyebrow">Workflow health</p>
        <h2 className="ui-section-title">Other workflow issues</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <OperationalQueueRow
            key={item.id}
            href={item.primaryAction?.href ?? primaryAction.href}
            eyebrow={statusLabel(item.status)}
            title={item.label}
            hint={item.detail ?? item.userImpact ?? statusLabel(item.status)}
            chips={item.chips}
            actionLabel={item.primaryAction?.label ?? primaryAction.label}
            tone={healthItemTone(item)}
          />
        ))}
      </div>
    </section>
  );
}
