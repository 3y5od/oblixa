"use server";

import { redirect } from "next/navigation";
import {
  createAdminClient,
  createClient,
  ensureUserOrg,
  getOrEnsureDeterministicMembership,
  resolveDefaultOrganizationNameForUser,
} from "@/lib/supabase/server";
import { resolveBlockingCalibrationPathForAdminOrg } from "@/lib/onboarding/calibration-gate";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapAuthError } from "@/lib/errors/user-facing";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";

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

export async function signUp(formData: FormData) {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`signup:${ip}`, RATE_LIMITS.signUp);
  if (!rl.ok) {
    return { error: "Too many sign-up attempts. Try again later." };
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

export async function signIn(formData: FormData) {
  const ip = await getClientIpFromHeaders();
  const rl = await rateLimitCheck(`signin:${ip}`, RATE_LIMITS.signIn);
  if (!rl.ok) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || email.length > 320 || !email.includes("@")) return { error: "Please enter a valid email address." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/api/auth/post-sign-out");
}

export async function forgotPassword(formData: FormData) {
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
