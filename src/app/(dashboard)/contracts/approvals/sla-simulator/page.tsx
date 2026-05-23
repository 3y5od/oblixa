import Link from "next/link";
import { Clock3 } from "lucide-react";
import { getAuthContext } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { SlaSimulatorClient } from "@/components/v4/sla-simulator-client";

export default async function ApprovalSlaSimulatorPage() {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  return (
    <div className="ui-page-stack">
      <DashboardPageHeader
        icon={<Clock3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow="Approvals"
        title="SLA simulator"
        lead="Model approval deadlines before you change live SLA policies. Results are indicative only."
        actions={
          <Link
            href="/contracts/approvals"
            className="ui-btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]"
          >
            Back to approvals
          </Link>
        }
      />
      <SlaSimulatorClient />
    </div>
  );
}
