"use server";

import { redirect } from "next/navigation";
import {
  createAdminClient,
  createClient,
  ensureUserOrg,
  getOrEnsureDeterministicMembership,
  resolveDefaultOrganizationNameForUser,
} from "@/lib/supabase/server";
import { recordSecurityAuditEvent } from "@/lib/security/audit-write";
import { resolveBlockingCalibrationPathForAdminOrg } from "@/lib/onboarding/calibration-gate";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapAuthError } from "@/lib/errors/user-facing";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { isKillSignup } from "@/lib/security/kill-switches";

type AuthActionResult = { error: string } | { success: string } | { redirectTo: string };

async function recoverAuthAction(scope: string, run: () => Promise<AuthActionResult>): Promise<AuthActionResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[auth] ${scope} failed`, error);
    return { error: "Sign-in could not be completed. Refresh the page and try again." };
  }
}

async function resolvePostAuthRedirectForUser(user: {
  id: string;
  user_metadata?: {
    full_name?: unknown;
  } | null;
}) {
  const admin = await createAdminClient();
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  const calibrationPath = await resolveBlockingCalibrationPathForAdminOrg({
    admin,
    userId: user.id,
    orgId: membership?.organization_id ?? null,
  });
  return calibrationPath ?? "/dashboard";
}

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  return recoverAuthAction("signUp", () => signUpUnsafe(formData));
}

async function signUpUnsafe(formData: FormData): Promise<AuthActionResult> {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`signup:${ip}`, RATE_LIMITS.signUp);
  if (!rl.ok) {
    return { error: "Too many sign-up attempts. Try again later." };
  }
  if (isKillSignup()) {
    return { error: "New sign-ups are temporarily disabled." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || email.length > 320 || !email.includes("@")) return { error: "Please enter a valid email address." };
  if (!password || password.length < 8 || password.length > 128) return { error: "Password must be between 8 and 128 characters." };
  if (fullName && fullName.length > 200) return { error: "Name is too long." };

  const appUrl = await resolveAppBaseUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  if (data.user && !data.session) {
    return { success: "Check your email to confirm your account." };
  }

  if (data.user) {
    try {
      await ensureUserOrg(data.user.id, resolveDefaultOrganizationNameForUser(data.user));
    } catch (e) {
      console.error("[auth] ensureUserOrg failed", e);
      return { error: "Account setup failed. Please try again." };
    }
  }

  // Client navigation (not `redirect()`): `useActionState` forms expect a serializable
  // action result; `redirect()` in the same action breaks the Flight/action response in Next 15+.
  return { redirectTo: "/dashboard" };
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  return recoverAuthAction("signIn", () => signInUnsafe(formData));
}

async function signInUnsafe(formData: FormData): Promise<AuthActionResult> {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`signin:${ip}`, RATE_LIMITS.signIn);
  if (!rl.ok) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || email.length > 320 || !email.includes("@")) return { error: "Please enter a valid email address." };

  const t0 = Date.now();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const elapsed = Date.now() - t0;
    await new Promise((r) => setTimeout(r, Math.max(0, 200 - elapsed)));
    return { error: mapAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { redirectTo: await resolvePostAuthRedirectForUser(user) };
  }

  return { redirectTo: "/dashboard" };
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      const admin = await createAdminClient();
      const membership = await getOrEnsureDeterministicMembership(admin, user);
      if (membership?.organization_id) {
        void recordSecurityAuditEvent(admin, {
          organizationId: membership.organization_id,
          actorUserId: user.id,
          action: "security.session_signed_out",
          targetType: "auth_session",
          targetId: user.id,
          outcome: "success",
          safeMetadata: {},
        });
      }
    } catch (e) {
      console.error("[auth] signOut security audit skipped:", e);
    }
  }
  await supabase.auth.signOut();
  redirect("/api/auth/post-sign-out");
}

export async function forgotPassword(formData: FormData) {
  return recoverAuthAction("forgotPassword", () => forgotPasswordUnsafe(formData));
}

async function forgotPasswordUnsafe(formData: FormData): Promise<AuthActionResult> {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`forgot:${ip}`, RATE_LIMITS.forgotPassword);
  if (!rl.ok) {
    return { error: "Too many reset requests. Try again later." };
  }

  const supabase = await createClient();
  const email = formData.get("email") as string;

  if (!email || email.length > 320 || !email.includes("@")) return { error: "Please enter a valid email address." };

  const appUrl = await resolveAppBaseUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { success: "Check your email for a password reset link." };
}

export async function resetPassword(formData: FormData) {
  return recoverAuthAction("resetPassword", () => resetPasswordUnsafe(formData));
}

async function resetPasswordUnsafe(formData: FormData): Promise<AuthActionResult> {
  const supabase = await createClient();
  const password = formData.get("password") as string;

  if (!password || password.length < 8 || password.length > 128) return { error: "Password must be between 8 and 128 characters." };

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { redirectTo: await resolvePostAuthRedirectForUser(user) };
  }
  return { redirectTo: "/dashboard" };
}
