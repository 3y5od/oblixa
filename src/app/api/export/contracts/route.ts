import { NextResponse } from "next/server";
import {
  RATE_LIMITS,
  getClientIpFromRequest,
  rateLimitCheck,
} from "@/lib/rate-limit";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { FIELD_NAMES } from "@/lib/types";
import { isUuid } from "@/lib/security/validation";
import type { WorkspaceRole } from "@/lib/navigation";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";

function csvEscape(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  let t = String(value);
  // CSV / spreadsheet formula injection (OWASP)
  if (/^[=+\-@\t\r]/.test(t)) {
    t = `'${t}`;
  }
  if (/[",\n\r]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgIdParam = new URL(request.url).searchParams.get("orgId")?.trim() ?? "";
  if (orgIdParam && !isUuid(orgIdParam)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    return NextResponse.json(
      { error: mapDataSourceError(membershipError.message) },
      { status: 500 }
    );
  }

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id).filter(Boolean))];

  if (orgIds.length === 0) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  let orgId: string;
  let memberRole: WorkspaceRole = "viewer";
  if (orgIdParam) {
    if (!orgIds.includes(orgIdParam)) {
      return NextResponse.json({ error: "Access denied for orgId" }, { status: 403 });
    }
    orgId = orgIdParam;
    const row = (memberships ?? []).find((m) => m.organization_id === orgIdParam);
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else if (orgIds.length === 1) {
    orgId = orgIds[0];
    const row = (memberships ?? []).find((m) => m.organization_id === orgId);
    if (row?.role) memberRole = row.role as WorkspaceRole;
  } else {
    return NextResponse.json(
      {
        error:
          "Multiple organizations found. Include ?orgId=<organization-id> to export a specific organization.",
      },
      { status: 400 }
    );
  }
  const modeGate = await requireApiWorkspaceEligibility({
    admin,
    orgId,
    role: memberRole,
    apiPath: "/api/export/contracts",
  });
  if (modeGate) return modeGate;

  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitCheck(`export-contracts:${user.id}:${ip}`, RATE_LIMITS.exportContractsCsv);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))) },
      }
    );
  }

  const { data: contracts, error } = await admin
    .from("contracts")
    .select(
      "id, title, counterparty, contract_type, status, region, created_at, owner_id, extracted_fields(field_name, field_value, status)"
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: mapDataSourceError(error.message) },
      { status: 500 }
    );
  }

  const ownerIds = [
    ...new Set(
      (contracts ?? [])
        .map((c) => c.owner_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const ownerEmailById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    for (const p of profiles ?? []) {
      if (p.email) ownerEmailById.set(p.id, p.email);
    }
  }

  const header = [
    "id",
    "title",
    "counterparty",
    "contract_type",
    "status",
    "region",
    "owner_email",
    "created_at",
    ...FIELD_NAMES.map((f) => `field_${f}`),
    ...FIELD_NAMES.map((f) => `field_${f}_status`),
  ];

  const lines = [header.join(",")];

  for (const row of contracts ?? []) {
    const fields = (row.extracted_fields ?? []) as {
      field_name: string;
      field_value: string | null;
      status: string;
    }[];
    const byName = new Map(fields.map((f) => [f.field_name, f]));

    const ownerEmail = row.owner_id
      ? (ownerEmailById.get(row.owner_id) ?? "")
      : "";

    const base = [
      row.id,
      row.title,
      row.counterparty ?? "",
      row.contract_type ?? "",
      row.status,
      row.region ?? "",
      ownerEmail,
      row.created_at,
    ].map(csvEscape);

    const values = FIELD_NAMES.map((name) =>
      csvEscape(byName.get(name)?.field_value ?? "")
    );
    const statuses = FIELD_NAMES.map((name) =>
      csvEscape(byName.get(name)?.status ?? "")
    );

    lines.push([...base, ...values, ...statuses].join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `contracts-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
