"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleCheck,
  Clock,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MailCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { forgotPassword, resetPassword, signIn, signUp } from "@/actions/auth";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";
import { MODE_CONFIG, type AuthMode } from "./auth-config";
import { AuthShell, AuthCard, type AuthCardTone } from "./auth-shell";
import { AuthProductPanel, AuthProductFacts } from "./auth-product-panel";
import { AuthFields } from "./auth-fields";
import { AuthStateCard, type AuthStateTone } from "./auth-state-card";
import { AuthWorkspaceCallout } from "./auth-workspace-callout";
import { AuthIconTile } from "./auth-ui";

type SignupGrantState =
  | "valid_workspace_creation"
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "revoked"
  | "unavailable";

interface AuthFormProps {
  mode: AuthMode;
  urlBanner?: string;
  accessCode?: string;
  signupGrantState?: SignupGrantState;
  linkInvalid?: boolean;
}

type AuthState = { error?: string; success?: string; redirectTo?: string } | undefined;
type AuthAction = (formData: FormData) => Promise<NonNullable<AuthState>>;

const authActions: Record<AuthMode, AuthAction> = {
  login: signIn,
  signup: signUp,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
};

async function runAuthAction(mode: AuthMode, formData: FormData): Promise<AuthState> {
  try {
    return await authActions[mode](formData);
  } catch (error) {
    console.error("[auth-form] action failed", error);
    return { error: "Sign-in could not be completed. Refresh the page and try again." };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  fullName?: string;
  password?: string;
  confirm?: string;
}

type RecoveryAction = "request-access" | "sign-in" | "contact";
type RecoveryInfo = {
  chip: string;
  heading: string;
  body: string;
  tone: AuthStateTone;
  icon: LucideIcon;
  primary: RecoveryAction;
  secondary: RecoveryAction;
};

const RECOVERY: Record<Exclude<SignupGrantState, "valid_workspace_creation">, RecoveryInfo> = {
  missing: {
    chip: "No link",
    heading: "Access link required",
    body: "Signup opens after workspace access is approved or an invite is issued.",
    tone: "neutral",
    icon: KeyRound,
    primary: "request-access",
    secondary: "sign-in",
  },
  invalid: {
    chip: "Invalid",
    heading: "Access link not recognized",
    body: "This link can't be used to create a workspace account. Request access to continue.",
    tone: "warning",
    icon: XCircle,
    primary: "request-access",
    secondary: "sign-in",
  },
  expired: {
    chip: "Expired",
    heading: "Access link expired",
    body: "Request a new access link to create your workspace account.",
    tone: "warning",
    icon: Clock,
    primary: "request-access",
    secondary: "contact",
  },
  revoked: {
    chip: "Revoked",
    heading: "Access link no longer active",
    body: "This link was revoked. Request access again or ask for a new invite.",
    tone: "warning",
    icon: Ban,
    primary: "request-access",
    secondary: "contact",
  },
  used: {
    chip: "Used",
    heading: "Access link already used",
    body: "This link already created an account. Sign in, or request a new invite.",
    tone: "neutral",
    icon: RotateCcw,
    primary: "sign-in",
    secondary: "request-access",
  },
  unavailable: {
    chip: "Unavailable",
    heading: "Access check unavailable",
    body: "We couldn't verify this link right now. Try again shortly or request a fresh link.",
    tone: "warning",
    icon: RefreshCw,
    primary: "request-access",
    secondary: "contact",
  },
};

const RECOVERY_ACTION: Record<RecoveryAction, { href: string; label: string }> = {
  "request-access": { href: "/request-access", label: "Request access" },
  "sign-in": { href: "/login", label: "Sign in" },
  contact: { href: "/contact", label: "Contact support" },
};

/** Quiet trust chip under the submit button — a small icon + sentence-case
 *  reassurance, replacing the dot-separated proof prose (§10.7). */
function ProofChip({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-raised)_55%,transparent)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--text-tertiary)]">
      <Icon className="h-3 w-3 shrink-0" strokeWidth={1.85} aria-hidden />
      {children}
    </span>
  );
}

export function AuthForm({
  mode,
  urlBanner,
  accessCode = "",
  signupGrantState,
  linkInvalid = false,
}: AuthFormProps) {
  const [state, setState] = useState<AuthState>(undefined);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const path = state?.redirectTo;
    if (!path) return;
    if (mode === "reset-password") return;
    assignNavigableHref(path);
  }, [state, mode]);

  const c = MODE_CONFIG[mode];
  const formErrorId = "auth-form-error";
  const showProof = mode === "login" || mode === "signup";
  const isInvalidLink = mode === "reset-password" && linkInvalid;
  const isResetComplete = mode === "reset-password" && Boolean(state?.redirectTo) && !isInvalidLink;
  const isSuccess = Boolean(state?.success) && !isInvalidLink && !isResetComplete;
  const effectiveSignupGrantState: SignupGrantState | undefined =
    mode === "signup" ? signupGrantState ?? (accessCode ? "valid_workspace_creation" : "missing") : undefined;
  const blocksSignupForm = mode === "signup" && effectiveSignupGrantState !== "valid_workspace_creation";
  const recoveryInfo: RecoveryInfo | null = blocksSignupForm
    ? RECOVERY[effectiveSignupGrantState as keyof typeof RECOVERY]
    : null;
  const denied = mode === "signup" && Boolean(state?.error?.includes("approved workspace access"));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const get = (key: string) => String(formData.get(key) ?? "");
    const errs: FieldErrors = {};

    if (mode !== "reset-password" && !EMAIL_RE.test(get("email").trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (mode === "signup" && !get("fullName").trim()) {
      errs.fullName = "Enter your name.";
    }
    if (mode === "login" && !get("password")) {
      errs.password = "Enter your password.";
    }
    if (mode === "signup") {
      const pw = get("password");
      if (!pw) errs.password = "Create a password.";
      else if (pw.length < 8) errs.password = "Use at least 8 characters.";
    }
    if (mode === "reset-password") {
      const pw = get("password");
      if (!pw) errs.password = "Enter a new password.";
      else if (pw.length < 8) errs.password = "Use at least 8 characters.";
      if (pw && pw !== get("confirmPassword")) errs.confirm = "Passwords do not match.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Focus the first errored field for keyboard recovery.
      const focusOrder: [keyof FieldErrors, string][] = [
        ["email", "email"],
        ["fullName", "fullName"],
        ["password", "password"],
        ["confirm", "confirmPassword"],
      ];
      for (const [key, fieldId] of focusOrder) {
        if (errs[key]) {
          document.getElementById(fieldId)?.focus();
          break;
        }
      }
      return;
    }

    setFieldErrors({});
    setState(undefined);
    startTransition(async () => {
      setState(await runAuthAction(mode, formData));
    });
  }

  const formContent = (
    <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
      {c.note ? (
        <p className="flex items-start gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-4 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
          <span>{c.note}</span>
        </p>
      ) : null}

      {urlBanner ? (
        <div className="ui-alert-warning flex items-start gap-2" role="alert">
          <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <p>{urlBanner}</p>
        </div>
      ) : null}

      {mode === "signup" && effectiveSignupGrantState === "valid_workspace_creation" ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-[color:color-mix(in_oklab,var(--success)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_22%,var(--surface-raised))] px-3 py-1.5 text-[11.5px] font-medium text-[var(--success-ink)]"
        >
          <CircleCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          Access link ready — sign up with the email it was issued for.
        </p>
      ) : null}

      {state?.error ? (
        <div id={formErrorId} role="alert" aria-live="assertive" className="ui-alert-error flex items-start gap-2">
          <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <div className="min-w-0 space-y-2.5">
            <p>{state.error}</p>
            {denied ? (
              <Link
                href="/request-access"
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Request access
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <AuthFields
        mode={mode}
        accessCode={accessCode}
        emailError={fieldErrors.email}
        nameError={fieldErrors.fullName}
        passwordError={fieldErrors.password}
        confirmError={fieldErrors.confirm}
      />

      <div className="space-y-2.5">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="ui-btn-primary group h-11 w-full text-[14px]"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.85} aria-hidden />
              {c.pending}
            </>
          ) : (
            <>
              {c.submit}
              <ArrowRight
                className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden
              />
            </>
          )}
        </button>

        {showProof ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <ProofChip icon={ShieldCheck}>Encrypted in transit</ProofChip>
            <ProofChip icon={Lock}>Workspace-scoped</ProofChip>
            <ProofChip icon={EyeOff}>No data on public pages</ProofChip>
            <Link
              href="/security"
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Security
            </Link>
          </div>
        ) : null}
      </div>
    </form>
  );

  const successContent = (
    <AuthStateCard
      tone="success"
      icon={MailCheck}
      chip={mode === "signup" ? undefined : "Check email"}
      heading={mode === "signup" ? "Account created" : "Check your email"}
      body={
        mode === "signup"
          ? state?.success ?? ""
          : "If an account exists for that address, a password reset link is on its way."
      }
    >
      <Link href="/login" className="ui-btn-ghost">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        Back to sign in
      </Link>
    </AuthStateCard>
  );

  const resetCompleteContent = (
    <AuthStateCard tone="success" icon={CircleCheck} heading="Password updated" body="Your password has been updated.">
      <Link href={state?.redirectTo ?? "/dashboard"} className="ui-btn-primary">
        Continue to your workspace
      </Link>
    </AuthStateCard>
  );

  const invalidLinkContent = (
    <AuthStateCard
      tone="warning"
      icon={TriangleAlert}
      chip="Link expired"
      heading="This reset link is invalid or expired"
      body="Request a new link to set your password."
    >
      <Link href="/forgot-password" className="ui-btn-primary">
        Request a new link
      </Link>
      <Link href="/login" className="ui-btn-ghost">
        Back to sign in
      </Link>
    </AuthStateCard>
  );

  const signupRecoveryContent = recoveryInfo ? (
    <AuthStateCard
      tone={recoveryInfo.tone}
      icon={recoveryInfo.icon}
      chip={recoveryInfo.chip}
      heading={recoveryInfo.heading}
      body={recoveryInfo.body}
    >
      <Link href={RECOVERY_ACTION[recoveryInfo.primary].href} className="ui-btn-primary">
        {RECOVERY_ACTION[recoveryInfo.primary].label}
      </Link>
      <Link href={RECOVERY_ACTION[recoveryInfo.secondary].href} className="ui-btn-ghost">
        {RECOVERY_ACTION[recoveryInfo.secondary].label}
      </Link>
    </AuthStateCard>
  ) : null;

  const cardBody = isInvalidLink
    ? invalidLinkContent
    : isResetComplete
      ? resetCompleteContent
      : isSuccess
        ? successContent
        : signupRecoveryContent ?? formContent;

  const cardTone: AuthCardTone | undefined = isInvalidLink
    ? "warning"
    : isResetComplete || isSuccess
      ? "success"
      : recoveryInfo
        ? recoveryInfo.tone
        : undefined;

  const showCallout =
    Boolean(c.callout) && !isSuccess && !isInvalidLink && !isResetComplete && !signupRecoveryContent;

  const authColumn = (
    <div className={showProof ? "min-w-0" : "w-full"}>
      <div className="mb-4 flex items-start gap-3.5">
        <AuthIconTile icon={c.icon} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="landing-eyebrow-dot ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">{c.eyebrow}</span>
            {c.headerChip ? (
              <span className="ui-caps-3 inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[9px] text-[var(--text-secondary)]">
                {c.headerChip}
              </span>
            ) : null}
          </p>
          <h1 className="mt-1 text-balance text-[1.75rem] font-semibold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
            {c.title}
          </h1>
          <p className="mt-1.5 max-w-[42ch] text-pretty text-[13px] leading-[1.5] text-[var(--text-secondary)]">{c.intro}</p>
        </div>
      </div>

      {showProof ? (
        <AuthProductFacts className="mb-5 grid grid-cols-1 gap-x-6 gap-y-2.5 min-[420px]:grid-cols-2 lg:hidden" />
      ) : null}

      <AuthCard tone={cardTone}>{cardBody}</AuthCard>

      {showCallout && c.callout ? <AuthWorkspaceCallout callout={c.callout} /> : null}
    </div>
  );

  return <AuthShell productPanel={showProof ? <AuthProductPanel /> : undefined}>{authColumn}</AuthShell>;
}
