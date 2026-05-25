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
import {
  containsControlOrBidi,
  isReasonableEmail,
  validateBoundedString,
} from "@/lib/security/validation";

type AuthActionResult = { error: string } | { success: string } | { redirectTo: string };

const MAX_AUTH_EMAIL_LEN = 254;
const MAX_AUTH_PASSWORD_LEN = 128;
const MIN_AUTH_PASSWORD_LEN = 8;
const MAX_AUTH_NAME_LEN = 200;

function readAuthEmail(formData: FormData): { ok: true; value: string } | { ok: false; error: string } {
  const validation = validateBoundedString(formData.get("email") ?? "", { maxLength: MAX_AUTH_EMAIL_LEN });
  if (!validation.ok) return { ok: false, error: "Please enter a valid email address." };
  const email = validation.value.toLowerCase();
  if (!isReasonableEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  return { ok: true, value: email };
}

function readAuthDisplayName(formData: FormData): { ok: true; value: string } | { ok: false; error: string } {
  const validation = validateBoundedString(formData.get("fullName") ?? "", {
    maxLength: MAX_AUTH_NAME_LEN,
    allowEmpty: true,
  });
  if (!validation.ok) {
    if (validation.error === "string_too_long") return { ok: false, error: "Name is too long." };
    return { ok: false, error: "Name contains unsupported characters." };
  }
  return { ok: true, value: validation.value };
}

function readAuthPassword(
  formData: FormData,
  options: { requireMinimum: boolean }
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = formData.get("password");
  if (typeof raw !== "string") return { ok: false, error: "Password must be between 8 and 128 characters." };
  if (containsControlOrBidi(raw)) return { ok: false, error: "Password contains unsupported characters." };
  if (raw.length > MAX_AUTH_PASSWORD_LEN) {
    return { ok: false, error: "Password must be between 8 and 128 characters." };
  }
  if (options.requireMinimum && raw.length < MIN_AUTH_PASSWORD_LEN) {
    return { ok: false, error: "Password must be between 8 and 128 characters." };
  }
  if (!options.requireMinimum && raw.length === 0) return { ok: false, error: "Please enter your password." };
  return { ok: true, value: raw };
}

async function recoverAuthAction(scope: string, run: () => Promise<AuthActionResult>): Promise<AuthActionResult> {
  try {
    return await run();
  } catch (error) {
    console.error(`[auth] ${scope} failed`, error);
    const mapped = mapAuthError(error as { message?: string; name?: string; status?: number; code?: string });
    if (mapped === "Authentication is temporarily unavailable. Try again in a few minutes.") {
      return { error: mapped };
    }
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

  const email = readAuthEmail(formData);
  if (!email.ok) return { error: email.error };
  const password = readAuthPassword(formData, { requireMinimum: true });
  if (!password.ok) return { error: password.error };
  const fullName = readAuthDisplayName(formData);
  if (!fullName.ok) return { error: fullName.error };

  const supabase = await createClient();

  const appUrl = await resolveAppBaseUrl();

  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: { full_name: fullName.value },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: mapAuthError(error) };
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
  const rl = await rateLimitCheck(`signin:${ip}`, RATE_LIMITS.signIn, {
    backendFailureMode: "memory-fallback",
    timeoutMs: 1_500,
  });
  if (!rl.ok) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const email = readAuthEmail(formData);
  if (!email.ok) return { error: email.error };
  const password = readAuthPassword(formData, { requireMinimum: false });
  if (!password.ok) return { error: password.error };

  const supabase = await createClient();

  const t0 = Date.now();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });

  if (error) {
    const elapsed = Date.now() - t0;
    await new Promise((r) => setTimeout(r, Math.max(0, 200 - elapsed)));
    return { error: mapAuthError(error.message) };
  }

  if (data.user) {
    try {
      return { redirectTo: await resolvePostAuthRedirectForUser(data.user) };
    } catch (error) {
      console.error("[auth] post-sign-in redirect resolution failed", error);
      return { redirectTo: "/dashboard" };
    }
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

  const email = readAuthEmail(formData);
  if (!email.ok) return { error: email.error };

  const supabase = await createClient();

  const appUrl = await resolveAppBaseUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    return { error: mapAuthError(error) };
  }

  return { success: "Check your email for a password reset link." };
}

export async function resetPassword(formData: FormData) {
  return recoverAuthAction("resetPassword", () => resetPasswordUnsafe(formData));
}

async function resetPasswordUnsafe(formData: FormData): Promise<AuthActionResult> {
  const password = readAuthPassword(formData, { requireMinimum: true });
  if (!password.ok) return { error: password.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password: password.value });

  if (error) {
    return { error: mapAuthError(error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { redirectTo: await resolvePostAuthRedirectForUser(user) };
  }
  return { redirectTo: "/dashboard" };
}
