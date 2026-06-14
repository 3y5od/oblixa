import { NextResponse } from "next/server";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "@/lib/http/problem";
import { attachOwnerProfiles } from "@/lib/contracts";
import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";
import { resolveSearchIndexFeatureFamily } from "@/lib/product-surface/feature-registry";
import { getAuthContext } from "@/lib/supabase/server";
import { evaluateFeatureEligibility } from "@/lib/product-surface/eligibility";
import { loadProductSurfaceContext } from "@/lib/product-surface/context";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import type { WorkspaceRole } from "@/lib/navigation";
import { emitV10ObjectiveTelemetryEvent } from "@/lib/product-telemetry";
import { applyV10CommandSearchVisibility } from "@/lib/visibility";
import { RATE_LIMITS, getClientIpFromRequest, rateLimitCheck } from "@/lib/rate-limit";
import {
  V10_COMMAND_INDEX_CANDIDATE_LIMIT,
  V10_COMMAND_RESPONSE_LIMIT,
  buildV10CommandSearchRecovery,
  buildV10CommandTelemetryDetails,
  contractMatchRank,
  resolveV10CommandSearchPlan,
  safeRankTerm,
  selectV10DiverseCommandResults,
  v10CommandActionLabel,
  v10IndexedResultRank,
  v10IndexedRowPassesStaticVisibility,
} from "@/lib/command-palette/contracts-search";

export {
  buildV10CommandSearchRecovery,
  buildV10CommandTelemetryDetails,
  contractMatchRank,
  matchRank,
  modeAllows,
  resolveV10CommandSearchPlan,
  selectV10DiverseCommandResults,
  v10CommandActionLabel,
  v10IndexedResultRank,
  v10IndexedRowPassesStaticVisibility,
} from "@/lib/command-palette/contracts-search";
export type { V10CommandSearchRecovery, V10CommandSearchRecoveryAction } from "@/lib/command-palette/contracts-search";

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const ROUTE = "/api/command-palette/contracts";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return jsonUnauthorized(ROUTE);
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
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`command-search:${ctx.user.id}:${ip}`, RATE_LIMITS.commandPaletteSearch);
  if (!rl.ok) return jsonRateLimited(rl.retryAfterMs, ROUTE);

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
    return jsonProblem(500, {
      error: "Could not search contracts",
      code: "contract_command_search_failed",
      diagnostic_id: "contract_command_search_failed",
      route: ROUTE,
    });
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
