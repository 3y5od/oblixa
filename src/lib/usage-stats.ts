import type { createAdminClient } from "@/lib/supabase/server";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

function startOfCurrentMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getOrgUsageStats(admin: Admin, orgId: string) {
  const since = startOfCurrentMonthIso();

  const [
    contractsCreatedResult,
    extractionsRunResult,
    fieldsApprovedResult,
    fieldsEditedResult,
    fieldsRejectedResult,
  ] = await Promise.all([
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action", "contract.created")
      .gte("created_at", since),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action", "extraction.completed")
      .gte("created_at", since),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action", "field.approved")
      .gte("created_at", since),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action", "field.edited")
      .gte("created_at", since),
    admin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action", "field.rejected")
      .gte("created_at", since),
  ]);

  for (const [label, res] of Object.entries({
    contractsCreated: contractsCreatedResult,
    extractionsRun: extractionsRunResult,
    fieldsApproved: fieldsApprovedResult,
    fieldsEdited: fieldsEditedResult,
    fieldsRejected: fieldsRejectedResult,
  })) {
    if (res.error) console.error(`[usage-stats] ${label} query error:`, res.error.message);
  }

  const contractsCreated = contractsCreatedResult.count;
  const extractionsRun = extractionsRunResult.count;
  const fieldsApproved = fieldsApprovedResult.count;
  const fieldsEdited = fieldsEditedResult.count;
  const fieldsRejected = fieldsRejectedResult.count;

  const fieldsReviewed =
    (fieldsApproved ?? 0) + (fieldsEdited ?? 0) + (fieldsRejected ?? 0);

  return {
    contractsCreated: contractsCreated ?? 0,
    extractionsRun: extractionsRun ?? 0,
    fieldsReviewed,
    periodLabel: "This calendar month (from audit log)",
  };
}
