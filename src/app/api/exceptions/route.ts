import { NextResponse } from "next/server";
import { getApiAuthContext } from "@/lib/v4/api-auth";

export async function GET(request: Request) {
  const ctx = await getApiAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");

  let query = ctx.admin
    .from("exceptions")
    .select(
      "id, contract_id, exception_type, title, severity, status, owner_id, due_date, root_cause, updated_at"
    )
    .eq("organization_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exceptions: data ?? [] });
}
