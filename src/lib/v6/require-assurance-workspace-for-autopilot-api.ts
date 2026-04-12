import { NextResponse } from "next/server";
import { parseWorkspaceMode } from "@/lib/product-surface/context";
import type { AdminClient } from "@/lib/v6/service";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";

export type AutopilotAssuranceGuardKind = "dry_run" | "api";

const MESSAGES: Record<AutopilotAssuranceGuardKind, string> = {
  dry_run:
    "Autopilot dry-run requires Assurance workspace mode (docs/refinement.md §17.2).",
  api: "Autopilot API requires Assurance workspace mode (docs/refinement.md §17.2).",
};

/**
 * Autopilot rules/runs APIs are Assurance-surface only (docs/refinement.md §17.2).
 * Returns a 403 JSON response when the org is not in Assurance mode, else null.
 */
export async function requireAssuranceWorkspaceForAutopilotApi(
  admin: AdminClient,
  orgId: string,
  kind: AutopilotAssuranceGuardKind = "api"
): Promise<NextResponse | null> {
  const v6 = await getV6OrgSettingsJson(admin, orgId);
  if (parseWorkspaceMode(v6) !== "assurance") {
    return NextResponse.json({ error: MESSAGES[kind] }, { status: 403 });
  }
  return null;
}
