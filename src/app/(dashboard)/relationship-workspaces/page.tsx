import { Users } from "lucide-react";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { RelationshipKeyJump } from "@/components/relationship/relationship-key-jump";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { getAuthContext } from "@/lib/supabase/server";
import { assertAnyV5PageFeature } from "@/lib/decision-intelligence/feature-guards";

export default async function RelationshipWorkspacesPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertAnyV5PageFeature(["v5RelationshipLayer"]);

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Users className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Relationship intelligence"
        title="Relationship workspaces"
        lead="Jump to account or counterparty summaries using stable keys aligned with contract rows."
      />
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        Keys are not guessed—populate <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1 text-[11px]">account_key</code> and{" "}
        <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1 text-[11px]">counterparty_key</code> on contracts first.
      </p>
      <RelationshipKeyJump />
    </div>
  );
}
