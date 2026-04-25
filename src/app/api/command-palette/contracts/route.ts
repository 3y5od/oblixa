import { NextResponse } from "next/server";
import { attachOwnerProfiles } from "@/lib/contracts";
import { normalizeContractsSearchQuery } from "@/lib/contracts-search-url";
import { getAuthContext } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = normalizeContractsSearchQuery(url.searchParams.get("q") ?? "");
  if (q.length < 2) {
    return NextResponse.json(
      { contracts: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const pattern = `%${q}%`;
  const { data, error } = await ctx.admin
    .from("contracts")
    .select("id, title, counterparty, status, owner_id, updated_at")
    .eq("organization_id", ctx.orgId)
    .or(`title.ilike.${pattern},counterparty.ilike.${pattern},contract_type.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[command-palette/contracts] query failed:", error.message);
    return NextResponse.json({ error: "Could not search contracts" }, { status: 500 });
  }

  const withOwners = await attachOwnerProfiles(ctx.admin, data ?? []);
  return NextResponse.json(
    {
      contracts: withOwners.map((contract) => ({
        id: contract.id,
        title: contract.title,
        counterparty: contract.counterparty,
        status: contract.status,
        ownerLabel: contract.owner?.full_name ?? contract.owner?.email ?? null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
