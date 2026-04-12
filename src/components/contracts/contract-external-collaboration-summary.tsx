import Link from "next/link";
import type { AdminClient } from "@/lib/v6/service";

/**
 * Open external action links whose scope_json includes `contractId` (set when creating links with that scope).
 * Caller must set `allowed` from product-surface eligibility (collaboration family) and feature flags.
 */
export async function ContractExternalCollaborationSummary({
  admin,
  orgId,
  contractId,
  allowed,
}: {
  admin: AdminClient;
  orgId: string;
  contractId: string;
  allowed: boolean;
}) {
  if (!allowed) return null;

  const { data: rows } = await admin
    .from("external_action_links")
    .select("id, token, action_type, status, expires_at, scope_json")
    .eq("organization_id", orgId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);

  const scoped = (rows ?? []).filter((r) => {
    const s = (r as { scope_json?: Record<string, unknown> }).scope_json ?? {};
    return s.contractId === contractId || s.contract_id === contractId;
  });

  if (scoped.length === 0) return null;

  return (
    <div className="mt-6 border-t border-zinc-100 pt-5">
      <p className="ui-eyebrow">Collaboration</p>
      <h2 className="ui-section-title mt-1 text-base">External collaboration (V6)</h2>
      <p className="ui-muted-tight mt-1">
        Open counterparty links scoped to this contract. Include <code className="rounded bg-zinc-100 px-1">contractId</code>{" "}
        in the link scope when creating requests.
      </p>
      <ul className="mt-2 space-y-2 text-xs text-zinc-700">
        {scoped.map((r) => {
          const row = r as { id: string; token: string; action_type: string; expires_at: string; scope_json?: unknown };
          const scope = row.scope_json as Record<string, unknown> | undefined;
          const chain = Array.isArray(scope?.workflow_chain) ? (scope!.workflow_chain as { type?: string }[]) : [];
          const stepTypes = chain.map((s) => s.type).filter(Boolean);
          const deadline = scope?.workflow_deadline_iso;
          const ack = scope?.workflow_ack_required === true;
          return (
            <li key={row.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
              <span className="font-medium text-zinc-900">{row.action_type.replace(/_/g, " ")}</span>
              <span className="text-zinc-500"> · expires {new Date(row.expires_at).toLocaleString()}</span>
              {deadline ? (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Workflow deadline: {String(deadline)}
                  {ack ? " · acknowledgement required" : ""}
                </p>
              ) : ack ? (
                <p className="mt-1 text-[11px] text-zinc-600">Acknowledgement required on external workflow.</p>
              ) : null}
              {stepTypes.length > 0 ? (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Chained steps ({chain.length}): {stepTypes.join(" → ")}
                </p>
              ) : chain.length > 0 ? (
                <p className="mt-1 text-[11px] text-zinc-600">Workflow steps recorded: {chain.length}</p>
              ) : null}
              <div className="mt-1">
                <Link className="ui-link font-mono text-[11px]" href={`/external/${row.token}`} target="_blank">
                  Open external page
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
