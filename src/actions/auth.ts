"use server";

import { redirect } from "next/navigation";
import {
  createAdminClient,
  createClient,
  ensureUserOrg,
  getDeterministicMembership,
} from "@/lib/supabase/server";
import { resolveBlockingCalibrationPathForAdminOrg } from "@/lib/onboarding/calibration-gate";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { mapAuthError } from "@/lib/errors/user-facing";
import {
  getClientIpFromHeaders,
  rateLimitCheck,
  RATE_LIMITS,
} from "@/lib/rate-limit";

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
    await ensureUserOrg(
      data.user.id,
      fullName ? `${fullName}'s Organization` : "My Organization"
    );
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = await createAdminClient();
    const membership = await getDeterministicMembership(admin, user.id);
    const orgId = membership?.organization_id ?? null;
    const calibrationPath = await resolveBlockingCalibrationPathForAdminOrg({
      admin,
      userId: user.id,
      orgId,
    });
    return { redirectTo: calibrationPath ?? "/dashboard" };
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

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { redirectTo: "/dashboard" };
}
