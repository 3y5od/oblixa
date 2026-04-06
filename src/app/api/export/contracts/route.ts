import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { mapDataSourceError } from "@/lib/errors/user-facing";
import { FIELD_NAMES } from "@/lib/types";

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

export async function GET() {
  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const orgId = membership.organization_id;

  const { data: contracts, error } = await admin
    .from("contracts")
    .select(
      "id, title, counterparty, contract_type, status, created_at, owner_id, extracted_fields(field_name, field_value, status)"
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
