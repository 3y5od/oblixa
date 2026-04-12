import { NextResponse } from "next/server";
import { readJsonBody, toSafeString } from "@/lib/v5/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireV6ApiFeature } from "@/lib/v6/feature-guards";
import { requireV6Context } from "@/lib/v6/api-auth";
import { runIncrementalAssuranceChecks } from "@/lib/v6/assurance-checks";
import { patchControlPolicySettings } from "@/lib/v6/control-policies";
import { requireApiWorkspaceEligibility } from "@/lib/product-surface/api-workspace-guard";
import { incrementV6QualityCounter } from "@/lib/v6/telemetry";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = requireV6ApiFeature("v6ControlPolicies");
  if (disabled) return disabled;

  const { ctx, errorResponse } = await requireV6Context("settings_manage");
  if (!ctx) return errorResponse!;

  const modeGate = await requireApiWorkspaceEligibility({
    admin: ctx.admin,
    orgId: ctx.orgId,
    role: ctx.role,
    apiPath: "/api/control-policies/[id]",
  });
  if (modeGate) return modeGate;

  const policyId = toSafeString((await params).id);
  const body = readJsonBody<{ remediationPlaybookId?: string | null }>(await request.json().catch(() => ({})), {});

  let remediationPlaybookId: string | null | undefined;
  if ("remediationPlaybookId" in body) {
    const raw = body.remediationPlaybookId;
    if (raw === null || raw === "") {
      remediationPlaybookId = null;
    } else {
      const pbId = toSafeString(raw);
      if (!pbId) {
        return NextResponse.json({ error: "remediationPlaybookId invalid" }, { status: 400 });
      }
      const { data: pb } = await ctx.admin
        .from("adaptive_playbooks")
        .select("id")
        .eq("organization_id", ctx.orgId)
        .eq("id", pbId)
        .maybeSingle();
      if (!pb) {
        return NextResponse.json({ error: "Playbook not found in this organization" }, { status: 400 });
      }
      remediationPlaybookId = pbId;
    }
  }

  if (!("remediationPlaybookId" in body)) {
    return NextResponse.json({ error: "remediationPlaybookId is required" }, { status: 400 });
  }

  const result = await patchControlPolicySettings(ctx.admin, ctx.orgId, policyId, {
    remediationPlaybookId,
  });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await incrementV6QualityCounter(ctx.admin, ctx.orgId, "api_patch_control_policy_remediation_total", 1).catch(
    () => undefined
  );
  if (isFeatureEnabled("v6AssuranceCore")) {
    await runIncrementalAssuranceChecks(ctx.admin, ctx.orgId, ctx.userId).catch(() => undefined);
  }
  return NextResponse.json({ policy: result.data });
}
