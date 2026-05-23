import { cookies } from "next/headers";
import { isStepUpCookieValidForUser } from "@/lib/security/step-up-cookie";

type SupabaseMfaProofClient = {
  auth: {
    mfa?: {
      getAuthenticatorAssuranceLevel?: () => Promise<{
        data?: { currentLevel?: string | null } | null;
      }>;
    };
  };
};

export async function hasSensitiveActionProof(
  supabase: SupabaseMfaProofClient,
  userId: string
): Promise<boolean> {
  try {
    const jar = await cookies();
    if (isStepUpCookieValidForUser(jar, userId)) return true;
    const { data } = await supabase.auth.mfa?.getAuthenticatorAssuranceLevel?.() ?? {};
    return data?.currentLevel === "aal2";
  } catch {
    return false;
  }
}
