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
import { recoverPendingOrganizationInviteForAuthenticatedUser } from "@/lib/auth/invite-recovery";
import { hasEmailConfirmationSignal } from "@/lib/auth/email-confirmation";
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
  isUuid,
  validateBoundedString,
} from "@/lib/security/validation";
import {
  markWorkspaceAccessGrantUsed,
  recoverApprovedWorkspaceAccessRequestForAuthenticatedUser,
  recoverWorkspaceAccessGrantForAuthenticatedUser,
  resolveApprovedAccessRequestWorkspaceName,
  validateConsumedWorkspaceAccessGrantForUser,
  validateWorkspaceAccessGrant,
  type ApprovedAccessRequestRecoveryRow,
  type AccessGrantRow,
} from "@/lib/access-review";

export type AuthActionResult = { error: string } | { success: string } | { redirectTo: string };

const MAX_AUTH_EMAIL_LEN = 254;
const MAX_AUTH_PASSWORD_LEN = 128;
const MIN_AUTH_PASSWORD_LEN = 8;
const MAX_AUTH_NAME_LEN = 200;
const MAX_AUTH_COMPANY_LEN = 200;
const MAX_AUTH_ACCESS_CODE_LEN = 160;

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

function readAuthCompanyName(formData: FormData): { ok: true; value: string } | { ok: false; error: string } {
  const validation = validateBoundedString(formData.get("companyName") ?? "", {
    maxLength: MAX_AUTH_COMPANY_LEN,
    allowEmpty: true,
  });
  if (!validation.ok) {
    if (validation.error === "string_too_long") return { ok: false, error: "Company name is too long." };
    return { ok: false, error: "Company name contains unsupported characters." };
  }
  return { ok: true, value: validation.value };
}

function readAuthAccessCode(formData: FormData): { ok: true; value: string } | { ok: false; error: string } {
  const validation = validateBoundedString(formData.get("accessCode") ?? "", {
    maxLength: MAX_AUTH_ACCESS_CODE_LEN,
    allowEmpty: true,
  });
  if (!validation.ok) {
    return { ok: false, error: "Access code contains unsupported characters." };
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
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  user_metadata?: {
    full_name?: unknown;
    company_name?: unknown;
    access_grant_id?: unknown;
  } | null;
}): Promise<string | null> {
  const admin = await createAdminClient();
  let membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership && (await ensureFirstWorkspaceFromConsumedAccessGrant(admin, user))) {
    membership = await getOrEnsureDeterministicMembership(admin, user);
  }
  if (!membership) {
    const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
    if (hasEmailConfirmationSignal(user) && isReasonableEmail(normalizedEmail)) {
      const recoveredInvite = await recoverPendingOrganizationInviteForAuthenticatedUser(admin, {
        email: normalizedEmail,
        userId: user.id,
      });
      if (recoveredInvite.ok) {
        membership = {
          organization_id: recoveredInvite.organizationId,
          role: recoveredInvite.role,
        };
      }
    }
  }
  if (!membership) return null;
  const calibrationPath = await resolveBlockingCalibrationPathForAdminOrg({
    admin,
    userId: user.id,
    orgId: membership.organization_id,
  });
  return calibrationPath ?? "/dashboard";
}

async function ensureFirstWorkspaceFromConsumedAccessGrant(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    user_metadata?: {
      full_name?: unknown;
      company_name?: unknown;
      access_grant_id?: unknown;
    } | null;
  }
): Promise<boolean> {
  const accessGrantId =
    typeof user.user_metadata?.access_grant_id === "string"
      ? user.user_metadata.access_grant_id
      : "";

  const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
  if (!isReasonableEmail(normalizedEmail)) return false;

  if (isUuid(accessGrantId)) {
    const grant = await resolveConsumedAccessGrantByIdForUser(admin, {
      grantId: accessGrantId,
      email: normalizedEmail,
      userId: user.id,
    });
    if (grant) {
      return ensureWorkspaceForRecoveredAccessGrant(admin, { user, grant });
    }
  }

  if (!hasEmailConfirmationSignal(user)) return false;

  const recovered = await recoverWorkspaceAccessGrantForAuthenticatedUser(admin, {
    email: normalizedEmail,
    userId: user.id,
  });
  if (!recovered.ok) {
    const request = await recoverApprovedWorkspaceAccessRequestForAuthenticatedUser(admin, {
      email: normalizedEmail,
    });
    if (!request.ok) return false;
    return ensureWorkspaceForApprovedAccessRequest(admin, {
      user,
      request: request.request,
    });
  }

  await admin.auth.admin.updateUserById?.(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      access_grant_id: recovered.grant.id,
    },
  });
  return ensureWorkspaceForRecoveredAccessGrant(admin, { user, grant: recovered.grant });
}

async function ensureWorkspaceForApprovedAccessRequest(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    user: {
      id: string;
      user_metadata?: {
        full_name?: unknown;
        company_name?: unknown;
      } | null;
    };
    request: ApprovedAccessRequestRecoveryRow;
  }
): Promise<boolean> {
  const metadataName = resolveDefaultOrganizationNameForUser(input.user);
  const orgName =
    metadataName !== "My Organization"
      ? metadataName
      : resolveApprovedAccessRequestWorkspaceName(input.request, metadataName);
  await ensureUserOrg(input.user.id, orgName, admin);
  const membership = await getOrEnsureDeterministicMembership(admin, input.user);
  return Boolean(membership);
}

async function resolveConsumedAccessGrantByIdForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: { grantId: string; email: string; userId: string }
): Promise<AccessGrantRow | null> {
  const { data: grant, error } = await admin
    .from("workspace_access_grants")
    .select("id, request_id, normalized_email, status, expires_at, issued_by, used_by, used_at, revoked_at, created_at")
    .eq("id", input.grantId)
    .maybeSingle();
  if (error || !grant) return null;

  const row = grant as AccessGrantRow;
  if (
    row.status !== "used" ||
    row.used_by !== input.userId ||
    row.normalized_email !== input.email
  ) {
    return null;
  }

  return row;
}

async function resolveRecoveredAccessGrantWorkspaceName(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    grant: AccessGrantRow;
    user: {
      user_metadata?: {
        full_name?: unknown;
        company_name?: unknown;
      } | null;
    };
  }
): Promise<string> {
  const metadataName = resolveDefaultOrganizationNameForUser(input.user);
  if (metadataName !== "My Organization") return metadataName;
  if (!input.grant.request_id) return metadataName;

  const { data, error } = await admin
    .from("workspace_access_requests")
    .select("company_name, requester_name")
    .eq("id", input.grant.request_id)
    .maybeSingle();
  if (error || !data) return metadataName;

  const companyName =
    typeof (data as { company_name?: unknown }).company_name === "string"
      ? (data as { company_name: string }).company_name.trim()
      : "";
  if (companyName) return companyName;

  const requesterName =
    typeof (data as { requester_name?: unknown }).requester_name === "string"
      ? (data as { requester_name: string }).requester_name.trim()
      : "";
  return requesterName ? `${requesterName}'s Organization` : metadataName;
}

async function ensureWorkspaceForRecoveredAccessGrant(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    user: {
      id: string;
      user_metadata?: {
        full_name?: unknown;
        company_name?: unknown;
        access_grant_id?: unknown;
      } | null;
    };
    grant: AccessGrantRow;
  }
): Promise<boolean> {
  const orgName = await resolveRecoveredAccessGrantWorkspaceName(admin, {
    grant: input.grant,
    user: input.user,
  });
  await ensureUserOrg(input.user.id, orgName, admin);
  const membership = await getOrEnsureDeterministicMembership(admin, input.user);
  return Boolean(membership);
}

function isAuthUserAlreadyRegisteredError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const lower = message.toLowerCase();
  return lower.includes("user already registered") || lower.includes("already registered");
}

async function consumeGrantAndEnsureWorkspaceForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    user: {
      id: string;
      email?: string;
      user_metadata?: {
        full_name?: unknown;
        company_name?: unknown;
        access_grant_id?: unknown;
      } | null;
    };
    grantId: string;
    fullName: string;
    companyName: string;
    rollbackGrantOnWorkspaceFailure?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = {
    ...input.user,
    user_metadata: {
      ...(input.user.user_metadata ?? {}),
      full_name: input.fullName,
      company_name: input.companyName,
      access_grant_id: input.grantId,
    },
  };

  await admin.auth.admin.updateUserById?.(user.id, {
    user_metadata: user.user_metadata,
  });

  const consumed = await markWorkspaceAccessGrantUsed(admin, {
    grantId: input.grantId,
    userId: user.id,
  });
  if (!consumed.ok) {
    console.error("[auth] access grant consume failed", { reason: consumed.error });
    return { ok: false, error: "grant_consume_failed" };
  }

  await ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user), admin);
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) {
    console.error("[auth] workspace membership missing after signup provisioning", {
      userId: user.id,
      grantId: input.grantId,
    });
    if (input.rollbackGrantOnWorkspaceFailure) {
      await rollbackWorkspaceAccessGrantUseForUser(admin, {
        grantId: input.grantId,
        userId: user.id,
      });
    }
    return { ok: false, error: "workspace_missing" };
  }

  return { ok: true };
}

async function rollbackWorkspaceAccessGrantUseForUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: { grantId: string; userId: string }
): Promise<void> {
  try {
    const { error } = await admin
      .from("workspace_access_grants")
      .update({ status: "issued", used_by: null, used_at: null })
      .eq("id", input.grantId)
      .eq("status", "used")
      .eq("used_by", input.userId);
    if (error) {
      console.error("[auth] access grant rollback failed", { reason: "update_failed" });
    }
  } catch {
    console.error("[auth] access grant rollback failed", { reason: "unavailable" });
  }
}

async function ensureWorkspaceForConsumedGrantUser(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  input: {
    user: {
      id: string;
      email?: string;
      user_metadata?: {
        full_name?: unknown;
        company_name?: unknown;
        access_grant_id?: unknown;
      } | null;
    };
    grantId: string;
    fullName: string;
    companyName: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = {
    ...input.user,
    user_metadata: {
      ...(input.user.user_metadata ?? {}),
      full_name: input.fullName,
      company_name: input.companyName,
      access_grant_id: input.grantId,
    },
  };

  await admin.auth.admin.updateUserById?.(user.id, {
    user_metadata: user.user_metadata,
  });

  await ensureUserOrg(user.id, resolveDefaultOrganizationNameForUser(user), admin);
  const membership = await getOrEnsureDeterministicMembership(admin, user);
  if (!membership) {
    console.error("[auth] workspace membership missing after consumed-grant recovery", {
      userId: user.id,
      grantId: input.grantId,
    });
    return { ok: false, error: "workspace_missing" };
  }

  return { ok: true };
}

async function recoverExistingAccountFromConsumedGrant(input: {
  admin: Awaited<ReturnType<typeof createAdminClient>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  accessCode: string;
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}): Promise<AuthActionResult | null> {
  const { data, error } = await input.supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.user) return null;

  const consumed = await validateConsumedWorkspaceAccessGrantForUser(input.admin, {
    token: input.accessCode,
    email: input.email,
    userId: data.user.id,
  });
  if (!consumed.ok) {
    await input.supabase.auth.signOut();
    return null;
  }

  const membership = await getOrEnsureDeterministicMembership(input.admin, data.user);
  if (!membership) {
    const provisioned = await ensureWorkspaceForConsumedGrantUser(input.admin, {
      user: data.user,
      grantId: consumed.grant.id,
      fullName: input.fullName,
      companyName: input.companyName,
    });
    if (!provisioned.ok) {
      await input.supabase.auth.signOut();
      return { error: "Account setup failed. Please try again." };
    }
  }

  const postAuthPath = await resolvePostAuthRedirectForUser(data.user);
  return { redirectTo: postAuthPath ?? "/dashboard" };
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
  const companyName = readAuthCompanyName(formData);
  if (!companyName.ok) return { error: companyName.error };
  const accessCode = readAuthAccessCode(formData);
  if (!accessCode.ok) return { error: accessCode.error };
  if (!accessCode.value) {
    return {
      error:
        "Signup requires approved workspace access. Request access if your team tracks what signed contracts require next.",
    };
  }

  const supabase = await createClient();
  const admin = await createAdminClient();
  const grant = await validateWorkspaceAccessGrant(admin, {
    token: accessCode.value,
    email: email.value,
  });
  if (!grant.ok) {
    if (grant.error === "grant_used") {
      const recovered = await recoverExistingAccountFromConsumedGrant({
        admin,
        supabase,
        accessCode: accessCode.value,
        email: email.value,
        password: password.value,
        fullName: fullName.value,
        companyName: companyName.value,
      });
      if (recovered) return recovered;
    }
    const grantError =
      grant.error === "grant_email_mismatch"
        ? "This access link is for a different email address."
        : grant.error === "grant_expired"
          ? "This access link has expired. Request access again or ask for a new invite."
          : grant.error === "grant_revoked"
            ? "This access link is no longer active. Request access again or ask for a new invite."
          : grant.error === "grant_used"
            ? "This access link has already been used. Sign in or request a new invite."
            : "Signup requires approved workspace access. Request access if your team tracks what signed contracts require next.";
    return { error: grantError };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: email.value,
    password: password.value,
    email_confirm: true,
    user_metadata: {
      full_name: fullName.value,
      company_name: companyName.value,
      access_grant_id: grant.grant.id,
    },
  });

  if (error) {
    if (isAuthUserAlreadyRegisteredError(error)) {
      const { data: existingSignInData, error: existingSignInError } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (existingSignInError || !existingSignInData.user) {
        return { error: "An account with this email already exists. Sign in with that account to continue." };
      }

      const existingMembership = await getOrEnsureDeterministicMembership(admin, existingSignInData.user);
      if (!existingMembership) {
        const provisioned = await consumeGrantAndEnsureWorkspaceForUser(admin, {
          user: existingSignInData.user,
          grantId: grant.grant.id,
          fullName: fullName.value,
          companyName: companyName.value,
        });
        if (!provisioned.ok) {
          await supabase.auth.signOut();
          return { error: "Account setup failed. Please try again." };
        }
      }

      const postAuthPath = await resolvePostAuthRedirectForUser(existingSignInData.user);
      return { redirectTo: postAuthPath ?? "/dashboard" };
    }
    return { error: mapAuthError(error) };
  }

  if (!data.user) {
    return { error: "Account setup failed. Please try again." };
  }

  const createdUser = data.user;
  const provisioned = await consumeGrantAndEnsureWorkspaceForUser(admin, {
    user: createdUser,
    grantId: grant.grant.id,
    fullName: fullName.value,
    companyName: companyName.value,
    rollbackGrantOnWorkspaceFailure: true,
  });
  if (!provisioned.ok) {
    await admin.auth.admin.deleteUser(createdUser.id).catch((deleteError) => {
      console.error("[auth] rollback user delete failed", deleteError);
    });
    return { error: "Account setup failed. Please try again." };
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  });
  if (signInError) {
    console.error("[auth] post-signup sign-in failed", signInError.message);
    return { success: "Account created. Sign in to continue." };
  }

  const postAuthUser = signInData.user ?? createdUser;
  const postAuthPath = await resolvePostAuthRedirectForUser(postAuthUser);
  return { redirectTo: postAuthPath ?? "/dashboard" };
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
      const postAuthPath = await resolvePostAuthRedirectForUser(data.user);
      if (!postAuthPath) {
        await supabase.auth.signOut();
        return {
          error:
            "No workspace is linked to this account. Request access or ask an admin for an invite.",
        };
      }
      return { redirectTo: postAuthPath };
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
    const postAuthPath = await resolvePostAuthRedirectForUser(user);
    if (!postAuthPath) {
      await supabase.auth.signOut();
      return {
        error:
          "No workspace is linked to this account. Request access or ask an admin for an invite.",
      };
    }
    return { redirectTo: postAuthPath };
  }
  return { redirectTo: "/dashboard" };
}
