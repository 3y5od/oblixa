import { NextResponse } from "next/server";
import { nowIso, signExternalSubmitTicket } from "@/lib/v5/api";
import { createAdminClient } from "@/lib/supabase/server";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const disabled = requireV5ApiFeature("v5ExternalCollaboration");
  if (disabled) return disabled;
  const { token } = await params;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("external_action_links")
    .select("id, action_type, status, expires_at, requires_reauth, submitted_at, passcode_hash")
    .eq("token", token)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "External action not found" }, { status: 404 });

  const expired = data.expires_at && data.expires_at < nowIso();
  const effectiveStatus = expired && data.status === "open" ? "expired" : data.status;
  const { passcode_hash: _h, ...rest } = data;
  const submitTicket =
    data.requires_reauth && effectiveStatus === "open" && !expired
      ? signExternalSubmitTicket({ linkId: data.id, urlToken: token })
      : undefined;
  return NextResponse.json({
    externalAction: {
      ...rest,
      requires_passcode: Boolean(_h),
      status: effectiveStatus,
      expired,
      submitTicket,
      reauth_instructions:
        data.requires_reauth && effectiveStatus === "open" && !expired
          ? "Call GET status before each submit; include submitTicket from this response in your POST body."
          : undefined,
    },
  });
}

