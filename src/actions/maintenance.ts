"use server";

import { createAdminClient, createClient, getOrEnsureDeterministicMembership } from "@/lib/supabase/server";
import { hasOrgCapability } from "@/lib/actions/access";
import { isUuid } from "@/lib/security/validation";
import { mapDataSourceError } from "@/lib/errors/user-facing";

async function canManageMaintenance(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  organizationId: string
) {
  return await hasOrgCapability({
    admin,
    organizationId,
    userId,
    capability: "maintenance_manage",
    allowContractEditors: true,
  });
}

export async function archiveContractAsDuplicateForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "duplicate candidate").trim();
  if (!isUuid(contractId)) return { error: "Invalid contract" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };
  if (!(await canManageMaintenance(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  await admin
    .from("contracts")
    .update({
      status: "terminated",
      intake_status: "archived",
      required_next_step: null,
    })
    .eq("id", contractId);

  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contractId,
    user_id: user.id,
    action: "maintenance.archived_duplicate",
    details: { reason },
  });
  return { success: true as const };
}

export async function reassignOwnerForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim();
  if (!isUuid(contractId) || !isUuid(ownerId)) return;
  const { updateContractOwner } = await import("@/actions/contracts");
  const res = await updateContractOwner(contractId, ownerId);
  if (res && "error" in res && res.error) {
    console.error("[maintenance] reassignOwnerForm", res.error);
  }
}

export async function deleteOrphanFileRecordForm(formData: FormData) {
  const fileId = String(formData.get("fileId") ?? "").trim();
  if (!isUuid(fileId)) return { error: "Invalid file" };
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const member = await getOrEnsureDeterministicMembership(admin, user);
  if (!member) return { error: "No organization membership" };
  if (!(await canManageMaintenance(admin, user.id, member.organization_id))) {
    return { error: "Access denied" };
  }

  const { data: file } = await admin
    .from("contract_files")
    .select("id, contract_id, contracts(id, organization_id)")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { error: "File not found" };
  const rel = file.contracts as unknown;
  const contract = (Array.isArray(rel) ? rel[0] : rel) as
    | { id?: string; organization_id?: string }
    | null;
  if (contract?.id && contract.organization_id === member.organization_id) {
    return { error: "File is still linked to a contract in this organization" };
  }

  const { error } = await admin.from("contract_files").delete().eq("id", fileId);
  if (error) {
    return { error: mapDataSourceError(error.message) };
  }
  return { success: true as const };
}

export async function runDateBackfillCampaignForm(formData: FormData) {
  const fieldName = String(formData.get("fieldName") ?? "").trim();
  const fallbackDate = String(formData.get("fallbackDate") ?? "").trim();
  const contractType = String(formData.get("contractType") ?? "").trim() || null;
  if (!fieldName || !fallbackDate) return { error: "Field name and fallback date are required" };
  if (!["end_date", "renewal_date", "notice_window", "effective_date", "start_date"].includes(fieldName)) {
    return { error: "Invalid field name" };
  }
  if (Number.isNaN(new Date(`${fallbackDate}T12:00:00`).getTime())) {
    return { error: "Invalid fallback date" };
  }
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return { error: "No organization membership" };
  if (!(await canManageMaintenance(admin, user.id, membership.organization_id))) {
    return { error: "Access denied" };
  }

  let contractsQuery = admin
    .from("contracts")
    .select("id, organization_id")
    .eq("organization_id", membership.organization_id)
    .limit(500);
  if (contractType) contractsQuery = contractsQuery.eq("contract_type", contractType);
  const { data: contracts } = await contractsQuery;
  const contractIds = (contracts ?? []).map((row) => row.id);
  if (contractIds.length === 0) return { success: true as const, backfilled: 0 };
  const { data: existing } = await admin
    .from("extracted_fields")
    .select("contract_id")
    .in("contract_id", contractIds)
    .eq("field_name", fieldName)
    .eq("status", "approved");
  const existingSet = new Set((existing ?? []).map((row) => row.contract_id));
  const missingIds = contractIds.filter((id) => !existingSet.has(id));
  if (missingIds.length === 0) return { success: true as const, backfilled: 0 };
  await admin.from("extracted_fields").insert(
    missingIds.map((contractId) => ({
      contract_id: contractId,
      field_name: fieldName,
      field_value: fallbackDate,
      source: "human",
      confidence: 1,
      status: "edited",
      source_snippet: "Backfilled via maintenance campaign",
    }))
  );
  await admin.from("audit_events").insert({
    organization_id: membership.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "maintenance.date_backfill_campaign",
    details: { field_name: fieldName, fallback_date: fallbackDate, contract_count: missingIds.length, contract_type: contractType },
  });
  return { success: true as const, backfilled: missingIds.length };
}

export async function runCorrectionCampaignForm(formData: FormData) {
  const campaignType = String(formData.get("campaignType") ?? "").trim();
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return { error: "No organization membership" };
  if (!(await canManageMaintenance(admin, user.id, membership.organization_id))) {
    return { error: "Access denied" };
  }

  let affected = 0;
  if (campaignType === "normalize_counterparty") {
    const { data: rows } = await admin
      .from("contracts")
      .select("id, counterparty")
      .eq("organization_id", membership.organization_id)
      .limit(1000);
    for (const row of rows ?? []) {
      const normalized = row.counterparty?.trim().replace(/\s{2,}/g, " ") ?? null;
      if (normalized === row.counterparty) continue;
      await admin.from("contracts").update({ counterparty: normalized }).eq("id", row.id);
      affected++;
    }
  } else if (campaignType === "clear_stale_next_steps") {
    const { data: rows } = await admin
      .from("contracts")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("health_status", "healthy")
      .not("required_next_step", "is", null)
      .limit(1000);
    const ids = (rows ?? []).map((row) => row.id);
    if (ids.length > 0) {
      await admin
        .from("contracts")
        .update({ required_next_step: null })
        .in("id", ids);
      affected = ids.length;
    }
  } else {
    return { error: "Invalid campaign type" };
  }

  await admin.from("audit_events").insert({
    organization_id: membership.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "maintenance.correction_campaign",
    details: { campaign_type: campaignType, affected },
  });
  return { success: true as const, affected };
}

export async function logContractChangeEventForm(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "").trim();
  const impactLevel = String(formData.get("impactLevel") ?? "medium").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!isUuid(contractId) || !summary) return { error: "Contract ID and summary are required" };
  if (!["amendment", "pricing_update", "ownership_change", "other"].includes(eventType)) {
    return { error: "Invalid event type" };
  }
  if (!["low", "medium", "high"].includes(impactLevel)) return { error: "Invalid impact level" };

  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: contract } = await admin
    .from("contracts")
    .select("id, organization_id")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { error: "Contract not found" };
  if (!(await canManageMaintenance(admin, user.id, contract.organization_id))) {
    return { error: "Access denied" };
  }

  await admin.from("contract_change_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    event_type: eventType,
    summary,
    impact_level: impactLevel,
    requested_by: user.id,
  });
  await admin.from("audit_events").insert({
    organization_id: contract.organization_id,
    contract_id: contract.id,
    user_id: user.id,
    action: "maintenance.change_event_logged",
    details: { event_type: eventType, impact_level: impactLevel },
  });
  return { success: true as const };
}

export async function processContractChangeEventsForm(formData: FormData) {
  const maxRows = Math.min(
    100,
    Math.max(1, Number(String(formData.get("maxRows") ?? "").trim() || "25"))
  );
  const teamKey = String(formData.get("teamKey") ?? "").trim() || "ops";
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) return { error: "No organization membership" };
  if (!(await canManageMaintenance(admin, user.id, membership.organization_id))) {
    return { error: "Access denied" };
  }

  const { data: events } = await admin
    .from("contract_change_events")
    .select("id, contract_id, event_type, summary, impact_level")
    .eq("organization_id", membership.organization_id)
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(maxRows);
  if (!events || events.length === 0) return { success: true as const, processed: 0 };

  const nowIso = new Date().toISOString();
  for (const evt of events) {
    const title = `Change event follow-up: ${evt.event_type.replace(/_/g, " ")}`;
    const { data: existing } = await admin
      .from("contract_tasks")
      .select("id")
      .eq("contract_id", evt.contract_id)
      .eq("title", title)
      .in("status", ["open", "in_progress", "blocked"])
      .maybeSingle();
    if (!existing) {
      await admin.from("contract_tasks").insert({
        contract_id: evt.contract_id,
        organization_id: membership.organization_id,
        created_by: user.id,
        assignee_id: null,
        title,
        details: `${evt.summary}\nImpact: ${evt.impact_level}.`,
        status: "open",
        priority: evt.impact_level === "high" ? "high" : "medium",
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_via: "manual",
        team_key: teamKey,
      });
    }
    await admin.from("contract_change_events").update({ processed_at: nowIso }).eq("id", evt.id);
  }

  await admin.from("audit_events").insert({
    organization_id: membership.organization_id,
    contract_id: null,
    user_id: user.id,
    action: "maintenance.change_events_processed",
    details: { processed: events.length, team_key: teamKey },
  });
  return { success: true as const, processed: events.length };
}
