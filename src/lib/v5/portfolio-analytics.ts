import type { createAdminClient } from "@/lib/supabase/server";
import { forEachSupabaseRangePage } from "@/lib/supabase/range-pagination";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

export type ProgramWorkloadRow = {
  program_id: string;
  active_assignments: number;
  reason: string;
};

export type CounterpartyExceptionRow = {
  counterparty_key: string;
  open_exceptions: number;
  reason: string;
};

/** Shared with GET /api/intelligence/portfolio-by-program and reports UI. */
export async function getPortfolioByProgramRows(
  admin: Admin,
  organizationId: string
): Promise<{ programs: ProgramWorkloadRow[]; error: string | null }> {
  const byProgram = new Map<string, number>();
  const { error: pageError } = await forEachSupabaseRangePage<{ program_id: string }>(
    (from, to) =>
      admin
        .from("contract_program_assignments")
        .select("program_id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .range(from, to),
    (chunk) => {
      for (const r of chunk) {
        const pid = String(r.program_id);
        byProgram.set(pid, (byProgram.get(pid) ?? 0) + 1);
      }
    },
    { pageSize: 1000 }
  );
  if (pageError) return { programs: [], error: pageError.message };

  const programs = [...byProgram.entries()]
    .map(([program_id, active_assignments]) => ({
      program_id,
      active_assignments,
      reason: "Count of active contract_program_assignments rows for this program_id.",
    }))
    .sort((a, b) => b.active_assignments - a.active_assignments)
    .slice(0, 40);

  return { programs, error: null };
}

/** Shared with GET /api/intelligence/portfolio-by-counterparty and reports UI. */
export async function getPortfolioByCounterpartyRows(
  admin: Admin,
  organizationId: string
): Promise<{ counterparties: CounterpartyExceptionRow[]; error: string | null }> {
  const { data: exRows, error } = await admin
    .from("exceptions")
    .select("contract_id")
    .eq("organization_id", organizationId)
    .in("status", ["open", "in_progress"])
    .limit(800);
  if (error) return { counterparties: [], error: error.message };

  const cids = [...new Set((exRows ?? []).map((e) => e.contract_id).filter(Boolean))] as string[];
  if (cids.length === 0) {
    return { counterparties: [], error: null };
  }

  const { data: contracts, error: cErr } = await admin
    .from("contracts")
    .select("id, counterparty_key")
    .eq("organization_id", organizationId)
    .in("id", cids);
  if (cErr) return { counterparties: [], error: cErr.message };

  const idToCp = new Map(
    (contracts ?? []).map((c) => [String(c.id), (c.counterparty_key as string | null) ?? null])
  );
  const byCp = new Map<string, number>();
  for (const e of exRows ?? []) {
    const cid = e.contract_id ? String(e.contract_id) : "";
    const ck = idToCp.get(cid);
    if (!ck) continue;
    byCp.set(ck, (byCp.get(ck) ?? 0) + 1);
  }

  const counterparties = [...byCp.entries()]
    .map(([counterparty_key, open_exceptions]) => ({
      counterparty_key,
      open_exceptions,
      reason: "Open or in-progress exceptions on contracts with this counterparty_key.",
    }))
    .sort((a, b) => b.open_exceptions - a.open_exceptions)
    .slice(0, 40);

  return { counterparties, error: null };
}
