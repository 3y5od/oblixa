import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { RelationshipKeyJump } from "@/components/relationship/relationship-key-jump";
import { getAuthContext } from "@/lib/supabase/server";
import { assertAnyV5PageFeature } from "@/lib/v5/feature-guards";

export default async function RelationshipWorkspacesPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  assertAnyV5PageFeature(["v5RelationshipLayer"]);

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Relationship intelligence</p>
          <h1 className="ui-display-title mt-2">Relationship workspaces</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Jump to account or counterparty summaries using stable keys aligned with contract rows. Keys are
            not guessed—populate <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1 text-sm">account_key</code> and{" "}
            <code className="rounded bg-[color:color-mix(in_oklab,var(--surface-muted)_88%,var(--canvas))] px-1 text-sm">counterparty_key</code> on contracts first.
          </p>
        </div>
      </header>
      <RelationshipKeyJump />
    </div>
  );
}
