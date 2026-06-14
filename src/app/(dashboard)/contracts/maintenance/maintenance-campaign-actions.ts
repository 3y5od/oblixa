"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/supabase/server";

export async function createCampaignAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx) return;
  const name = String(formData.get("name") ?? "").trim();
  const campaignType = String(formData.get("campaignType") ?? "").trim() || "data_remediation";
  const contractIds = String(formData.get("seedContractIds") ?? "")
    .split(/[\n,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  if (!name) return;
  await ctx.admin
    .from("maintenance_campaigns")
    .insert({
      organization_id: ctx.orgId,
      name,
      campaign_type: campaignType,
      status: "draft",
      filter_json: {},
      created_by: ctx.user.id,
    })
    .select("id")
    .single()
    .then(async ({ data }) => {
      if (!data || contractIds.length === 0) return;
      await ctx.admin.from("maintenance_campaign_rows").insert(
        contractIds.map((contractId) => ({
          organization_id: ctx.orgId,
          campaign_id: data.id,
          contract_id: contractId,
          status: "pending",
        }))
      );
    });
  revalidatePath("/contracts/maintenance");
}

export async function runCampaignAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!ctx) return;
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  if (!campaignId) return;
  await ctx.admin
    .from("maintenance_campaigns")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("id", campaignId);
  const { data: rows } = await ctx.admin
    .from("maintenance_campaign_rows")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .limit(1000);
  await ctx.admin
    .from("maintenance_campaign_rows")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  await ctx.admin
    .from("maintenance_campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary_json: { processed: rows?.length ?? 0 },
    })
    .eq("organization_id", ctx.orgId)
    .eq("id", campaignId);
  revalidatePath("/contracts/maintenance");
}
