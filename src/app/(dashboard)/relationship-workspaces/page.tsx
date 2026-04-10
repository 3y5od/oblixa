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
      <header className="border-b border-zinc-200/60 pb-8">
        <div>
          <p className="ui-eyebrow">V5 relationship layer</p>
          <h1 className="ui-display-title mt-2">Relationship workspaces</h1>
          <p className="ui-muted-tight mt-3 max-w-2xl">
            Jump to account or counterparty summaries using stable keys aligned with contract rows. Keys are
            not guessed—populate <code className="rounded bg-zinc-100 px-1 text-sm">account_key</code> and{" "}
            <code className="rounded bg-zinc-100 px-1 text-sm">counterparty_key</code> on contracts first.
          </p>
        </div>
      </header>
      <RelationshipKeyJump />
    </div>
  );
}
