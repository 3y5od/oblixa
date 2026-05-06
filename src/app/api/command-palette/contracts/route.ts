import { NextResponse } from "next/server";
import { attachOwnerProfiles } from "@/lib/contracts";
import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";
import { resolveSearchIndexFeatureFamily } from "@/lib/product-surface/feature-registry";
import { getAuthContext } from "@/lib/supabase/server";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import type { WorkspaceRole } from "@/lib/navigation";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import { emitV10ObjectiveTelemetryEvent } from "@/lib/product-telemetry";
import { applyV10CommandSearchVisibility } from "@/lib/v10-visibility";
import { V10_PLANS, type V10Plan } from "@/lib/v10-release-contract";

const ROLE_ORDER: WorkspaceRole[] = ["viewer", "legal_reviewer", "finance_reviewer", "editor", "ops_manager", "manager", "admin"];
const MODE_ORDER: WorkspaceProductMode[] = ["core", "advanced", "assurance"];
const PLAN_ORDER: V10Plan[] = [...V10_PLANS];
const V10_COMMAND_INDEX_CANDIDATE_LIMIT = 24;
const V10_COMMAND_RESPONSE_LIMIT = 12;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export type V10CommandSearchRecoveryAction = {
  label: string;
  href: string;
  reason: "zero_result" | "partial_index" | "short_query" | "hidden_module_filtered";
};

export type V10CommandSearchRecovery = {
  message: string;
  diagnosticId: string | null;
  actions: readonly V10CommandSearchRecoveryAction[];
};

function roleAllows(actorRole: WorkspaceRole, minimumRole: string | null): boolean {
  const actorRank = ROLE_ORDER.indexOf(actorRole);
  const minimumRank = ROLE_ORDER.indexOf((minimumRole ?? "viewer") as WorkspaceRole);
  return actorRank >= Math.max(0, minimumRank);
}

function modeAllows(actorMode: WorkspaceProductMode, minimumMode: string | null): boolean {
  const actorRank = MODE_ORDER.indexOf(actorMode);
  const minimumRank = MODE_ORDER.indexOf((minimumMode ?? "core") as WorkspaceProductMode);
  return actorRank >= Math.max(0, minimumRank);
}

function planAllows(actorPlan: V10Plan, minimumPlan: string | null): boolean {
  const actorRank = PLAN_ORDER.indexOf(actorPlan);
  const minimumRank = PLAN_ORDER.indexOf((minimumPlan ?? "trial") as V10Plan);
  return actorRank >= Math.max(0, minimumRank);
}

function isV10Plan(value: unknown): value is V10Plan {
  return typeof value === "string" && V10_PLANS.includes(value as V10Plan);
}

export function resolveV10CommandSearchPlan(input: { v6?: unknown }): V10Plan {
  const v6 = input.v6 && typeof input.v6 === "object" ? (input.v6 as Record<string, unknown>) : {};
  const rawPlan = v6.workspace_plan ?? v6.billing_plan ?? v6.subscription_plan ?? v6.plan;
  return isV10Plan(rawPlan) ? rawPlan : "enterprise";
}

export function v10IndexedRowPassesStaticVisibility(
  actorRole: WorkspaceRole,
  actorMode: WorkspaceProductMode,
  actorPlan: V10Plan,
  row: {
    required_role_minimum?: string | null;
    workspace_mode_minimum?: string | null;
    plan_minimum?: string | null;
  }
): boolean {
  return (
    roleAllows(actorRole, row.required_role_minimum ?? null) &&
    modeAllows(actorMode, row.workspace_mode_minimum ?? null) &&
    planAllows(actorPlan, row.plan_minimum ?? null)
  );
}

function matchRank(query: string, label: string, description = ""): number {
  const q = query.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  if (normalizedLabel === q) return 0;
  if (normalizedLabel.startsWith(q)) return 1;
  if (normalizedDescription.startsWith(q)) return 2;
  if (normalizedLabel.includes(q)) return 3;
  if (normalizedDescription.includes(q)) return 4;
  return 5;
}

export function contractMatchRank(query: string, input: { title?: string | null; counterparty?: string | null; ownerLabel?: string | null }): number {
  const q = query.toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  const counterparty = (input.counterparty ?? "").toLowerCase();
  const owner = (input.ownerLabel ?? "").toLowerCase();
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (counterparty.startsWith(q)) return 2;
  if (title.includes(q)) return 3;
  if (counterparty.includes(q)) return 4;
  if (owner.includes(q)) return 5;
  return 6;
}

export function v10IndexedResultRank(query: string, row: { record_type: unknown; label: unknown; description_safe: unknown; rank_terms_safe: unknown }): number {
  const recordType = String(row.record_type ?? "");
  const description = String(row.description_safe ?? "");
  const rankTerms = Array.isArray(row.rank_terms_safe) ? row.rank_terms_safe.map(String) : [];
  const text = `${description} ${rankTerms.join(" ")}`.toLowerCase();
  const baseRank = Math.min(
    matchRank(query, String(row.label), description),
    rankTerms.some((term) => term.toLowerCase() === query.toLowerCase()) ? 1 : 5
  );
  if (recordType === "work_item") {
    if (text.includes("overdue")) return 0;
    if (text.includes("due today")) return 1;
    if (text.includes("blocked")) return 2;
    if (text.includes("assigned to me")) return 3;
    return Math.min(baseRank, 4);
  }
  if (recordType === "field") {
    if (text.includes("missing")) return Math.min(baseRank, 1);
    if (text.includes("rejected") || text.includes("ambiguous")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "approval") {
    if (text.includes("pending")) return Math.min(baseRank, 1);
    if (text.includes("changes requested") || text.includes("delegated")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "obligation") {
    if (text.includes("overdue")) return Math.min(baseRank, 1);
    if (text.includes("open") || text.includes("in progress")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "renewal_checkpoint") {
    if (text.includes("blocked")) return Math.min(baseRank, 1);
    if (text.includes("open") || text.includes("pending")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "exception") {
    if (text.includes("critical") || text.includes("high")) return Math.min(baseRank, 1);
    if (text.includes("medium") || text.includes("open")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "evidence_request") {
    if (text.includes("rejected")) return Math.min(baseRank, 1);
    if (text.includes("open") || text.includes("pending") || text.includes("requested")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "saved_view") {
    if (text.includes("pinned")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "reminder") {
    if (text.includes("scheduled")) return Math.min(baseRank, 2);
    if (text.includes("sent")) return Math.min(baseRank, 4);
    return Math.min(baseRank, 3);
  }
  if (recordType === "notification_delivery") {
    if (text.includes("failed") || text.includes("suppressed")) return Math.min(baseRank, 1);
    if (text.includes("retry")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "account" || recordType === "counterparty" || recordType === "relationship") {
    if (text.includes("critical") || text.includes("at risk") || text.includes("watch") || text.includes("degraded")) {
      return Math.min(baseRank, 2);
    }
    return Math.min(baseRank, 4);
  }
  if (recordType === "decision") {
    if (text.includes("blocked") || text.includes("pending")) return Math.min(baseRank, 1);
    if (text.includes("open")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "campaign") {
    if (text.includes("active")) return Math.min(baseRank, 2);
    if (text.includes("rollback safe")) return Math.min(baseRank, 3);
    return Math.min(baseRank, 4);
  }
  if (recordType === "program") {
    if (text.includes("published") || text.includes("active")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "finding") {
    if (text.includes("critical") || text.includes("high")) return Math.min(baseRank, 1);
    if (text.includes("open")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "control") {
    if (text.includes("enforce") || text.includes("block")) return Math.min(baseRank, 2);
    if (text.includes("warn")) return Math.min(baseRank, 3);
    return Math.min(baseRank, 4);
  }
  if (recordType === "playbook" || recordType === "automation_run") {
    if (text.includes("approval") || text.includes("failed") || text.includes("blocked")) {
      return Math.min(baseRank, 1);
    }
    if (text.includes("running") || text.includes("queued")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "simulation") {
    if (text.includes("running") || text.includes("queued")) return Math.min(baseRank, 2);
    if (text.includes("completed")) return Math.min(baseRank, 3);
    return Math.min(baseRank, 4);
  }
  if (recordType === "scorecard") {
    if (text.includes("active")) return Math.min(baseRank, 2);
    if (text.includes("score")) return Math.min(baseRank, 3);
    return Math.min(baseRank, 4);
  }
  if (recordType === "review_board" || recordType === "health_graph" || recordType === "segment") {
    if (text.includes("active") || text.includes("linked")) return Math.min(baseRank, 3);
    return Math.min(baseRank, 4);
  }
  if (recordType === "program_evolution") {
    if (text.includes("simulated") || text.includes("running")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "report_run" || recordType === "import_job" || recordType === "export_job") {
    if (text.includes("failed") || text.includes("partial")) return Math.min(baseRank, 1);
    if (text.includes("running") || text.includes("queued")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "extraction_job") {
    if (text.includes("failed_retryable") || text.includes("failed")) return Math.min(baseRank, 1);
    if (text.includes("running") || text.includes("queued")) return Math.min(baseRank, 2);
    return Math.min(baseRank, 4);
  }
  if (recordType === "workspace_health_diagnostic") {
    if (text.includes("failed") || text.includes("partial") || text.includes("stale")) return Math.min(baseRank, 1);
    return Math.min(baseRank, 3);
  }
  if (recordType.includes("job") && description.toLowerCase().includes("failed_retryable")) return Math.min(baseRank, 1);
  return baseRank;
}

export function v10CommandActionLabel(row: { record_type: unknown; description_safe: unknown }): string {
  const recordType = String(row.record_type ?? "");
  const description = String(row.description_safe ?? "").toLowerCase();
  const openActionByType: Record<string, string> = {
    contract: "Inspect contract",
    work_item: "Continue work",
    field: "Review field",
    obligation: "Review obligation",
    approval: "Review approval",
    renewal_checkpoint: "Review renewal",
    reminder: "Review renewal",
    exception: "Triage exception",
    evidence_request: "Review evidence",
    saved_view: "Load saved view",
    file_upload: "Inspect contract",
    extraction_job: "Review extraction",
    report_family: "Review reports",
    account: "Review workspace",
    counterparty: "Review workspace",
    relationship: "Inspect relationship",
    decision: "Review decision",
    campaign: "Review campaign",
    program: "Review program",
    finding: "Triage finding",
    control: "Review control",
    playbook: "Review playbook",
    automation_run: "Inspect automation",
    simulation: "Compare scenario",
    scorecard: "Review scorecard",
    review_board: "Review board",
    health_graph: "Inspect health graph",
    segment: "Review segment",
    program_evolution: "Review experiment",
    setting: "Configure settings",
    setting_destination: "Configure settings",
    nav: "Go to page",
  };
  if (recordType === "report_run") {
    if (description.includes("failed_retryable") || description.includes("partial") || description.includes("retry")) {
      return "Retry failed job";
    }
    if (description.includes("failed_terminal") || description.includes("failed")) return "Inspect diagnostics";
    return "Review report";
  }
  if (openActionByType[recordType]) return openActionByType[recordType];
  if (recordType === "notification_delivery") {
    return description.includes("failed") || description.includes("suppressed") ? "Inspect diagnostics" : "Review operations";
  }
  if (recordType === "workspace_health_diagnostic") return "Inspect diagnostics";
  const isJobLike =
    recordType.includes("job") ||
    recordType === "report_run" ||
    recordType === "import_failure" ||
    recordType === "export_failure" ||
    recordType === "extraction_failure" ||
    recordType === "report_failure";
  if (!isJobLike) return "Go to destination";
  if (description.includes("failed_retryable") || description.includes("partial") || description.includes("retry")) {
    return "Retry failed job";
  }
  if (description.includes("failed_terminal") || description.includes("failed")) return "Inspect diagnostics";
  return "Review job status";
}

export function selectV10DiverseCommandResults<T extends { resultType: string; rank: number; updatedAt: number; tieBreaker: string }>(
  results: readonly T[],
  limit = V10_COMMAND_RESPONSE_LIMIT
): T[] {
  const byType = new Map<string, T>();
  for (const result of results) {
    const current = byType.get(result.resultType);
    if (
      !current ||
      result.rank < current.rank ||
      (result.rank === current.rank && result.updatedAt > current.updatedAt) ||
      (result.rank === current.rank && result.updatedAt === current.updatedAt && result.tieBreaker < current.tieBreaker)
    ) {
      byType.set(result.resultType, result);
    }
  }
  const representatives = [...byType.values()].sort((a, b) => a.rank - b.rank || b.updatedAt - a.updatedAt || a.tieBreaker.localeCompare(b.tieBreaker));
  const selectedKeys = new Set(representatives.map((result) => result.tieBreaker));
  const remaining = results
    .filter((result) => !selectedKeys.has(result.tieBreaker))
    .sort((a, b) => a.rank - b.rank || b.updatedAt - a.updatedAt || a.tieBreaker.localeCompare(b.tieBreaker));
  return [...representatives, ...remaining].slice(0, limit);
}

function safeRankTerm(value: string): string {
  return value.replace(/[{}"]/g, "").trim();
}

export function buildV10CommandSearchRecovery(input: {
  query: string;
  resultCount: number;
  partialIndex: boolean;
  mode: WorkspaceProductMode;
  hiddenFilteredCount?: number;
}): V10CommandSearchRecovery | null {
  if (input.query.trim().length < 2) {
    return {
      message: "Type at least two characters to search contracts, work, reports, settings, and recoverable jobs.",
      diagnosticId: "v10_command_search_short_query",
      actions: [{ label: "Review work queue", href: "/work", reason: "short_query" }],
    };
  }
  if (input.resultCount > 0 && !input.partialIndex && (input.hiddenFilteredCount ?? 0) === 0) return null;
  const reason = input.partialIndex ? "partial_index" : "zero_result";
  const actions: V10CommandSearchRecoveryAction[] = [
    { label: "Review work queue", href: "/work", reason },
    { label: "Browse contracts", href: "/contracts", reason },
    { label: "Review reports", href: "/reports", reason },
    { label: "Check system health", href: "/settings/health", reason },
  ];
  if (input.mode !== "core") actions.push({ label: "Review decisions", href: "/decisions", reason });
  if (input.mode === "assurance") actions.push({ label: "Inspect assurance", href: "/assurance", reason });
  actions.push({ label: "Configure product settings", href: "/settings/product", reason });
  if ((input.hiddenFilteredCount ?? 0) > 0) {
    actions.push({ label: "Review hidden modules", href: "/settings/product", reason: "hidden_module_filtered" });
  }
  return {
    message: input.partialIndex
      ? "Some indexed destinations are temporarily unavailable; direct destinations are still available."
      : (input.hiddenFilteredCount ?? 0) > 0
        ? "Some matching destinations are hidden by workspace configuration; available destinations are still shown."
      : `No command result matched "${input.query}". Try a broader term or open a recovery destination.`,
    diagnosticId: input.partialIndex
      ? "v10_command_index_partial"
      : (input.hiddenFilteredCount ?? 0) > 0
        ? "v10_command_hidden_module_filtered"
        : "v10_command_zero_result",
    actions,
  };
}

export function buildV10CommandTelemetryDetails(input: {
  resultType: string;
  resultCount: number;
  v10IndexError: boolean;
  hiddenFilteredCount?: number;
  recoveryDiagnosticId?: string | null;
}) {
  return {
    query_class: "contract_command_search",
    result_type: input.resultType,
    result_count: input.resultCount,
    zero_result: input.resultCount === 0,
    recovery_used: input.v10IndexError || (input.hiddenFilteredCount ?? 0) > 0,
    v10_index_error: input.v10IndexError,
    hidden_filtered_count: input.hiddenFilteredCount ?? 0,
    recovery_diagnostic_id: input.recoveryDiagnosticId ?? null,
  };
}

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role as WorkspaceRole,
    apiPath: "/api/command-palette/contracts",
  });
  if (modeGate) return modeGate;

  const url = new URL(request.url);
  const q = normalizeContractsSearchQuery(url.searchParams.get("q") ?? "");
  if (q.length < 2) {
    return NextResponse.json(
      { contracts: [], recovery: buildV10CommandSearchRecovery({ query: q, resultCount: 0, partialIndex: false, mode: "core" }) },
      { headers: PRIVATE_NO_STORE_HEADERS }
    );
  }

  const pattern = `%${q}%`;
  const rankTerm = safeRankTerm(q);
  const productSurface = await loadProductSurfaceContext(ctx.admin, ctx.orgId, ctx.role as WorkspaceRole);
  const commandSearchPlan = resolveV10CommandSearchPlan(productSurface);
  const [{ data, error }, { data: v10Rows, error: v10Error }] = await Promise.all([
    ctx.admin
    .from("contracts")
    .select("id, title, counterparty, status, owner_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .or(`title.ilike.${pattern},counterparty.ilike.${pattern},contract_type.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
      .limit(12),
    applyV10CommandSearchVisibility(
      ctx.admin
        .from("v10_command_search_index")
        .select("record_type, record_id, label, description_safe, href, rank_terms_safe, feature_family, module_key, required_role_minimum, workspace_mode_minimum, plan_minimum, updated_at"),
      {
        organizationId: ctx.orgId,
        role: ctx.role,
        workspaceMode: productSurface.mode,
        plan: commandSearchPlan,
      }
    )
      .or(`label.ilike.${pattern},description_safe.ilike.${pattern},rank_terms_safe.cs.{${rankTerm}}`)
      .order("updated_at", { ascending: false })
      .limit(V10_COMMAND_INDEX_CANDIDATE_LIMIT),
  ]);

  if (error) {
    console.error("[command-palette/contracts] query failed:", error.message);
    return NextResponse.json({ error: "Could not search contracts" }, { status: 500, headers: PRIVATE_NO_STORE_HEADERS });
  }
  if (v10Error) {
    console.error("[command-palette/contracts] v10 index query failed:", v10Error.message);
  }

  const withOwners = await attachOwnerProfiles(ctx.admin, ctx.orgId, data ?? []);
  let hiddenFilteredCount = 0;
  const v10Results = (v10Rows ?? [])
    .filter((row) => {
      const visible = v10IndexedRowPassesStaticVisibility(ctx.role as WorkspaceRole, productSurface.mode, commandSearchPlan, row);
      if (!visible) hiddenFilteredCount += 1;
      return visible;
    })
    .filter((row) => {
      const featureFamily = resolveSearchIndexFeatureFamily({
        featureFamily: row.feature_family,
        moduleKey: row.module_key,
        href: row.href,
      });
      const eligibility = evaluateFeatureEligibility(productSurface, featureFamily, {
        surfaceType: "page",
        surfaceIdentifier: String(row.record_type ?? "v10_search_result"),
      });
      if (!eligibility.allowed) hiddenFilteredCount += 1;
      return eligibility.allowed;
    })
    .map((row) => ({
      id: String(row.record_id),
      title: String(row.label),
      counterparty: null,
      status: null,
      ownerLabel: null,
      href: String(row.href),
      resultType: String(row.record_type).replace(/_/g, " "),
      description: String(row.description_safe ?? "V10 indexed destination"),
      actionLabel: v10CommandActionLabel(row),
      rank: v10IndexedResultRank(q, row),
      updatedAt: Date.parse(String(row.updated_at ?? "")) || 0,
      tieBreaker: `${String(row.record_type ?? "")}:${String(row.record_id ?? "")}`,
    }))
    .sort((a, b) => a.rank - b.rank || b.updatedAt - a.updatedAt || a.tieBreaker.localeCompare(b.tieBreaker));

  const contractResults = withOwners
    .map((contract) => ({
      id: contract.id,
      title: contract.title,
      counterparty: contract.counterparty,
      status: contract.status,
      ownerLabel: contract.owner?.full_name ?? contract.owner?.email ?? null,
      rank: contractMatchRank(q, {
        title: contract.title,
        counterparty: contract.counterparty,
        ownerLabel: contract.owner?.full_name ?? contract.owner?.email ?? null,
      }),
      updatedAt: Date.parse(contract.updated_at ?? "") || 0,
    }))
    .sort((a, b) => a.rank - b.rank || b.updatedAt - a.updatedAt);
  const selectedV10Results = selectV10DiverseCommandResults(v10Results, V10_COMMAND_RESPONSE_LIMIT);
  const contracts = [
    ...selectedV10Results.map((result) => ({
      id: result.id,
      title: result.title,
      counterparty: result.counterparty,
      status: result.status,
      ownerLabel: result.ownerLabel,
      href: result.href,
      resultType: result.resultType,
      description: result.description,
      actionLabel: result.actionLabel,
    })),
    ...contractResults.map((result) => ({
      id: result.id,
      title: result.title,
      counterparty: result.counterparty,
      status: result.status,
      ownerLabel: result.ownerLabel,
    })),
  ].slice(0, V10_COMMAND_RESPONSE_LIMIT);

  const recovery = buildV10CommandSearchRecovery({
    query: q,
    resultCount: contracts.length,
    partialIndex: Boolean(v10Error),
    mode: productSurface.mode,
    hiddenFilteredCount,
  });

  if (contracts.length === 0 || v10Error || hiddenFilteredCount > 0) {
    await emitV10ObjectiveTelemetryEvent(ctx.admin, {
      organizationId: ctx.orgId,
      userId: ctx.user.id,
      objectiveKey: "search_as_router",
      action: contracts.length === 0 ? "product.v10.command_palette_zero_result" : "product.v10.command_palette_recovered",
      details: buildV10CommandTelemetryDetails({
        resultType:
          contracts[0] && "resultType" in contracts[0] ? String(contracts[0].resultType) : contracts.length > 0 ? "contract" : "none",
        resultCount: contracts.length,
        v10IndexError: Boolean(v10Error),
        hiddenFilteredCount,
        recoveryDiagnosticId: recovery?.diagnosticId ?? null,
      }),
    });
  }

  return NextResponse.json(
    {
      contracts,
      recovery,
      partial: v10Error
        ? {
            v10CommandIndex: "unavailable",
            reason: "V10 command index could not load; contract matches are still available.",
            diagnosticId: "v10_command_index_partial",
          }
        : null,
    },
    { headers: PRIVATE_NO_STORE_HEADERS }
  );
}
