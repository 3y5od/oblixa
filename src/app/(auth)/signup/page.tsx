import { headers } from "next/headers";
import { AuthForm } from "@/components/auth/auth-form";
import {
  createAdminClient,
} from "@/lib/supabase/server";
import {
  inspectWorkspaceAccessGrantToken,
  type AccessGrantInspectionState,
} from "@/lib/access-review";
import { RATE_LIMITS, rateLimitCheck } from "@/lib/rate-limit";
import { getTrustedClientIpFromHeaders } from "@/lib/security/trusted-forwarded";

export const metadata = {
  title: "Request access to Oblixa",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ access_code?: string; grant?: string; token?: string }>;
}) {
  const q = await searchParams;
  const accessCode = q.grant ?? q.access_code ?? q.token ?? "";
  let signupGrantState: AccessGrantInspectionState = "missing";
  if (accessCode) {
    const ip = getTrustedClientIpFromHeaders(await headers());
    const rl = await rateLimitCheck(`signup-grant-inspect:${ip}`, RATE_LIMITS.signupGrantInspect);
    if (rl.ok) {
      const admin = await createAdminClient();
      signupGrantState = (await inspectWorkspaceAccessGrantToken(admin, { token: accessCode })).state;
    } else {
      signupGrantState = "unavailable";
    }
  }

  return <AuthForm mode="signup" accessCode={accessCode} signupGrantState={signupGrantState} />;
}
