import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { SlaSimulatorClient } from "@/components/v4/sla-simulator-client";

export default async function ApprovalSlaSimulatorPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  return (
    <div className="ui-page-stack">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Approvals</p>
          <h1 className="ui-display-title mt-2">SLA simulator</h1>
          <p className="ui-page-lead mt-3">
            Model approval deadlines before you change live SLA policies. Results are indicative only.
          </p>
          <Link href="/contracts/approvals" className="ui-link mt-3 inline-block text-sm">
            ← Back to approvals
          </Link>
        </div>
      </header>
      <SlaSimulatorClient />
    </div>
  );
}
