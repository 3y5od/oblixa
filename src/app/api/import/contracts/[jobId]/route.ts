import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const [{ data: job }, { data: rows }] = await Promise.all([
    admin
      .from("contract_import_jobs")
      .select(
        "id, status, source, total_rows, valid_rows, inserted_rows, error_rows, created_at, updated_at"
      )
      .eq("id", jobId)
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
    admin
      .from("contract_import_job_rows")
      .select("id, row_index, title, owner_email, status, error_message, contract_id")
      .eq("job_id", jobId)
      .eq("organization_id", membership.organization_id)
      .order("row_index", { ascending: true })
      .limit(300),
  ]);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    job,
    rows: rows ?? [],
  });
}
