import { NextResponse } from "next/server";

/**
 * Optional defense-in-depth for inbound automation (`INBOUND_AUTOMATION_TOKEN`).
 * When `INBOUND_AUTOMATION_ORG_ALLOWLIST` is set to a comma-separated list of org UUIDs,
 * requests targeting any other organization receive 403.
 * When unset or empty after parsing, all orgs remain allowed (backward compatible).
 */
export function inboundOrgNotAllowedResponse(organizationId: string): NextResponse | null {
  const raw = process.env.INBOUND_AUTOMATION_ORG_ALLOWLIST?.trim();
  if (!raw) return null;

  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (allowed.size === 0) return null;

  const id = organizationId.trim().toLowerCase();
  if (!id) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  if (allowed.has(id)) return null;

  return NextResponse.json(
    { error: "Organization not permitted for inbound automation" },
    { status: 403 }
  );
}
