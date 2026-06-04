import { AuthForm } from "@/components/auth/auth-form";
import {
  createAdminClient,
} from "@/lib/supabase/server";
import {
  inspectWorkspaceAccessGrantToken,
  type AccessGrantInspectionState,
} from "@/lib/access-review";

export const metadata = {
  title: "Request access to Oblixa",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ access_code?: string; grant?: string; token?: string; invite?: string }>;
}) {
  const q = await searchParams;
  const accessCode = q.grant ?? q.access_code ?? q.token ?? q.invite ?? "";
  let signupGrantState: AccessGrantInspectionState = "missing";
  if (accessCode) {
    const admin = await createAdminClient();
    signupGrantState = (await inspectWorkspaceAccessGrantToken(admin, { token: accessCode })).state;
  }

  return <AuthForm mode="signup" accessCode={accessCode} signupGrantState={signupGrantState} />;
}
