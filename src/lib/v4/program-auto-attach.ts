import type { createAdminClient } from "@/lib/supabase/server";
import { appendCasefileEvent } from "@/lib/v4/casefile";
import { applyProgramToContract } from "@/lib/v4/execution-engine";
import { enqueueOutboundEvent } from "@/lib/integrations/events";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export type ContractSnapshotForAutoAttach = {
  id: string;
  organization_id: string;
  contract_type: string | null;
  source_system: string | null;
  counterparty: string | null;
  region: string | null;
  intake_source: string | null;
};

type AutoAttachRule = {
  match?: Record<string, unknown>;
  priority?: number;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function parseAutoAttachRules(defaultRoutingJson: unknown): AutoAttachRule[] {
  const root = asRecord(defaultRoutingJson);
  const raw = root.auto_attach_rules;
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r === "object") as AutoAttachRule[];
}

/** Returns true if contract satisfies all keys present on rule.match (AND). Empty match matches any contract. */
export function contractMatchesAutoAttachRule(
  contract: ContractSnapshotForAutoAttach,
  rule: AutoAttachRule
): boolean {
  const m = asRecord(rule.match);
  if (Object.keys(m).length === 0) return true;

  const norm = (s: string | null | undefined) => String(s ?? "").trim();
  const normLower = (s: string | null | undefined) => norm(s).toLowerCase();

  if ("contract_type" in m) {
    const want = m.contract_type;
    if (want == null || String(want).trim() === "") {
      if (norm(contract.contract_type) !== "") return false;
    } else if (norm(contract.contract_type).toLowerCase() !== String(want).trim().toLowerCase()) {
      return false;
    }
  }
  if ("source_system" in m) {
    const want = m.source_system;
    if (want == null || String(want).trim() === "") {
      if (norm(contract.source_system) !== "") return false;
    } else if (normLower(contract.source_system) !== String(want).trim().toLowerCase()) {
      return false;
    }
  }
  if ("intake_source" in m) {
    const want = m.intake_source;
    if (want == null || String(want).trim() === "") {
      if (norm(contract.intake_source) !== "") return false;
    } else if (normLower(contract.intake_source) !== String(want).trim().toLowerCase()) {
      return false;
    }
  }
  if ("region" in m) {
    const want = m.region;
    if (want == null || String(want).trim() === "") {
      if (norm(contract.region) !== "") return false;
    } else if (normLower(contract.region) !== String(want).trim().toLowerCase()) {
      return false;
    }
  }
  if ("counterparty_contains" in m && m.counterparty_contains != null && String(m.counterparty_contains).trim() !== "") {
    const needle = String(m.counterparty_contains).trim().toLowerCase();
    const hay = normLower(contract.counterparty);
    if (!hay.includes(needle)) return false;
  }

  return true;
}

export function programMatchesContract(
  contract: ContractSnapshotForAutoAttach,
  defaultRoutingJson: unknown
): boolean {
  const rules = parseAutoAttachRules(defaultRoutingJson);
  if (rules.length === 0) return false;
  return rules.some((r) => contractMatchesAutoAttachRule(contract, r));
}

function rulePriority(programDefaultRouting: unknown): number {
  const rules = parseAutoAttachRules(programDefaultRouting);
  let max = 0;
  for (const r of rules) {
    const p = Number(r.priority ?? 0);
    if (Number.isFinite(p) && p > max) max = p;
  }
  return max;
}

/**
 * For published programs whose default_routing_json.auto_attach_rules match the contract,
 * creates active assignments (if missing) and applies the current program version.
 */
export async function autoAttachProgramsForContract(input: {
  admin: AdminClient;
  contract: ContractSnapshotForAutoAttach;
  actorUserId: string;
}): Promise<{ attachedPrograms: string[] }> {
  const { admin, contract, actorUserId } = input;
  const attached: string[] = [];

  const { data: programs } = await admin
    .from("contract_programs")
    .select("id, name, current_version_id, default_routing_json, state")
    .eq("organization_id", contract.organization_id)
    .eq("state", "published")
    .not("current_version_id", "is", null);

  const candidates = (programs ?? [])
    .filter((p) => programMatchesContract(contract, p.default_routing_json))
    .sort((a, b) => rulePriority(b.default_routing_json) - rulePriority(a.default_routing_json));

  for (const program of candidates) {
    const programId = String(program.id);
    const versionId = program.current_version_id as string | null;
    if (!versionId) continue;

    const { data: existing } = await admin
      .from("contract_program_assignments")
      .select("id")
      .eq("organization_id", contract.organization_id)
      .eq("contract_id", contract.id)
      .eq("program_id", programId)
      .eq("status", "active")
      .maybeSingle();
    if (existing?.id) continue;

    const { data: assignment, error: insErr } = await admin
      .from("contract_program_assignments")
      .insert({
        organization_id: contract.organization_id,
        contract_id: contract.id,
        program_id: programId,
        program_version_id: versionId,
        assignment_mode: "auto",
        status: "active",
        assigned_by: actorUserId,
      })
      .select("id")
      .single();
    if (insErr || !assignment?.id) continue;

    await applyProgramToContract({
      admin,
      organizationId: contract.organization_id,
      contractId: contract.id,
      programId,
      assignmentId: String(assignment.id),
      versionId,
      actorUserId,
    });

    await admin.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contract.id,
      user_id: actorUserId,
      action: "program.auto_attached",
      details: { program_id: programId, program_name: program.name },
    });

    await appendCasefileEvent({
      admin,
      organizationId: contract.organization_id,
      contractId: contract.id,
      eventType: "program.applied",
      entityType: "contract_program",
      entityId: programId,
      actorUserId,
      details: { program_name: program.name, mode: "auto" },
    });

    await enqueueOutboundEvent({
      organizationId: contract.organization_id,
      eventType: "program.auto_attached",
      entityType: "contract_program",
      entityId: programId,
      payload: {
        contract_id: contract.id,
        program_id: programId,
        program_name: program.name,
      },
    });

    attached.push(programId);
  }

  return { attachedPrograms: attached };
}

const BACKFILL_CONTRACTS_LIMIT = 80;

/** Backfill auto-attach for contracts missing matching program assignments (cron-safe, bounded). */
export async function backfillAutoAttachPrograms(input: {
  admin: AdminClient;
  organizationId: string;
}): Promise<{ scanned: number; attached: number }> {
  const { admin, organizationId } = input;

  const { data: published } = await admin
    .from("contract_programs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("state", "published")
    .not("current_version_id", "is", null)
    .limit(1);
  if (!published?.length) return { scanned: 0, attached: 0 };

  const { data: fallbackMember } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .in("role", ["admin", "editor"])
    .limit(1)
    .maybeSingle();
  const fallbackActor = (fallbackMember?.user_id as string | null) ?? null;
  if (!fallbackActor) return { scanned: 0, attached: 0 };

  const { data: contracts } = await admin
    .from("contracts")
    .select(
      "id, organization_id, contract_type, source_system, counterparty, region, intake_source, owner_id, created_by"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(400);

  let scanned = 0;
  let attached = 0;
  const candidates = (contracts ?? []).slice(0, BACKFILL_CONTRACTS_LIMIT);

  for (const row of candidates) {
    scanned += 1;
    const contract: ContractSnapshotForAutoAttach = {
      id: String(row.id),
      organization_id: String(row.organization_id),
      contract_type: (row.contract_type as string | null) ?? null,
      source_system: (row.source_system as string | null) ?? null,
      counterparty: (row.counterparty as string | null) ?? null,
      region: (row.region as string | null) ?? null,
      intake_source: (row.intake_source as string | null) ?? null,
    };
    const actorUserId =
      (row.owner_id as string | null) || (row.created_by as string | null) || fallbackActor;
    const { attachedPrograms } = await autoAttachProgramsForContract({
      admin,
      contract,
      actorUserId,
    });
    if (attachedPrograms.length > 0) attached += attachedPrograms.length;
  }

  return { scanned, attached };
}
