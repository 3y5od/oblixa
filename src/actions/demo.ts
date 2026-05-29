"use server";

import { getAuthContext } from "@/lib/supabase/server";

/**
 * Inserts sample contracts for demos. Enable with `ENABLE_DEMO_SEED=true`.
 * Admin-only.
 */
export async function seedDemoWorkspace() {
  if (process.env.ENABLE_DEMO_SEED !== "true") {
    return { error: "Demo seed is disabled (set ENABLE_DEMO_SEED=true)." };
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return { error: "Demo seed is not available in production environments." };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: "Not authenticated" };
  if (ctx.role !== "admin") {
    return { error: "Only organization admins can load demo data." };
  }

  const { user, admin, orgId } = ctx;

  const samples = [
    {
      title: "Demo: Acme Corp MSA",
      counterparty: "Acme Corp",
      contract_type: "MSA",
      fields: [
        {
          field_name: "end_date",
          field_value: "2026-12-31",
          source_snippet: "Demo sample",
          confidence: 0.9,
          source: "human" as const,
          status: "pending" as const,
        },
        {
          field_name: "renewal_date",
          field_value: "2026-11-01",
          source_snippet: "Demo sample",
          confidence: 0.85,
          source: "human" as const,
          status: "pending" as const,
        },
      ],
    },
    {
      title: "Demo: Beta LLC SOW",
      counterparty: "Beta LLC",
      contract_type: "SOW",
      fields: [
        {
          field_name: "payment_cadence",
          field_value: "Monthly",
          source_snippet: "Demo sample",
          confidence: 0.8,
          source: "human" as const,
          status: "pending" as const,
        },
      ],
    },
  ];

  let created = 0;
  for (const s of samples) {
    const { data: contract, error: cErr } = await admin
      .from("contracts")
      .insert({
        title: s.title,
        counterparty: s.counterparty,
        contract_type: s.contract_type,
        organization_id: orgId,
        owner_id: user.id,
        created_by: user.id,
        status: "pending_review",
      })
      .select("id")
      .single();

    if (cErr || !contract) continue;

    for (const f of s.fields) {
      const { error: fieldErr } = await admin.from("extracted_fields").insert({
        contract_id: contract.id,
        field_name: f.field_name,
        field_value: f.field_value,
        source_snippet: f.source_snippet,
        confidence: f.confidence,
        source: f.source,
        status: f.status,
      });
      if (fieldErr) {
        console.error("[demo] extracted_fields insert:", fieldErr.message);
      }
    }

    await admin.from("audit_events").insert({
      organization_id: orgId,
      contract_id: contract.id,
      user_id: user.id,
      action: "contract.created",
      details: { title: s.title, demo: true },
    });

    created++;
  }

  return { success: true as const, created };
}
