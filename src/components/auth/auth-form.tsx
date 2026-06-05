"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  forgotPassword,
  resetPassword,
  signIn,
  signUp,
} from "@/actions/auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { LegalLinks } from "@/components/layout/legal-links";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { SPEC_MONTHLY_AMOUNT_MINOR } from "@/lib/billing/spec-prices";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/** Public Core monthly price, anchored to the billing constant so auth copy
 *  can never drift from the canonical $249 per month offer. */
const CORE_PRICE = `$${Math.round(SPEC_MONTHLY_AMOUNT_MINOR / 100)}/month`;

interface AuthFormProps {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  /** Server-driven message (e.g. auth callback query errors) */
  urlBanner?: string;
  /** Signup only: signed access grant, invite, or temporary compatibility token from the URL. */
  accessCode?: string;
  /** Signup only: route-level grant state, inspected server-side without exposing token details. */
  signupGrantState?:
    | "valid_workspace_creation"
    | "missing"
    | "invalid"
    | "expired"
    | "used"
    | "revoked"
    | "unavailable";
  /** Reset-password only: the recovery link is missing/expired (driven by the page's searchParams). */
  linkInvalid?: boolean;
}

type AuthState =
  | { error?: string; success?: string; redirectTo?: string }
  | undefined;

type AuthAction = (formData: FormData) => Promise<NonNullable<AuthState>>;

const authActions: Record<AuthFormProps["mode"], AuthAction> = {
  login: signIn,
  signup: signUp,
  "forgot-password": forgotPassword,
  "reset-password": resetPassword,
};

async function runAuthAction(mode: AuthFormProps["mode"], formData: FormData): Promise<AuthState> {
  try {
    return await authActions[mode](formData);
  } catch (error) {
    console.error("[auth-form] action failed", error);
    return { error: "Sign-in could not be completed. Refresh the page and try again." };
  }
}

const config = {
  login: {
    title: "Sign in to your account",
    submitLabel: "Sign in",
    intro: "Continue tracking dates, owners, work, evidence, and reports.",
    altText: "Need a workspace?",
    altLink: "/request-access",
    altLinkText: "Request access",
    altHint: `New workspaces start through access review. Core is ${CORE_PRICE}.`,
    note: "",
  },
  signup: {
    title: "Complete workspace access",
    submitLabel: "Create workspace account",
    intro: "Finish creating your account from an approved workspace grant or invite.",
    altText: "Already have an account?",
    altLink: "/login",
    altLinkText: "Sign in",
    altHint: "",
    note: "Signup is limited to approved or invited workspaces.",
  },
  "forgot-password": {
    title: "Reset your password",
    submitLabel: "Send reset link",
    intro: "Enter your workspace email and we'll send a reset link if an account exists.",
    altText: "Remember your password?",
    altLink: "/login",
    altLinkText: "Sign in",
    altHint: "",
    note: "For your security, we never reveal whether an email has an account.",
  },
  "reset-password": {
    title: "Set a new password",
    submitLabel: "Update password",
    intro: "Choose a new password for your workspace account.",
    altText: "",
    altLink: "",
    altLinkText: "",
    altHint: "",
    // Requirement lives under the field; no separate top note to avoid doubling.
    note: "",
  },
};

const pendingLabel: Record<AuthFormProps["mode"], string> = {
  login: "Signing in…",
  signup: "Creating account…",
  "forgot-password": "Sending link…",
  "reset-password": "Updating password…",
};

/** Structured product facts mapped to Core release surfaces (not decorative bullets). */
const PRODUCT_FACTS: { icon: LucideIcon; label: string }[] = [
  { icon: FileCheck, label: "Source-backed field review" },
  { icon: Users, label: "Owners, dates, and work" },
  { icon: ClipboardCheck, label: "Evidence requests and proof" },
  { icon: Download, label: "Reports and CSV export" },
];

/** Approved caps-token separator (§2.9 Tactic C) — never a bare middle dot. */
function DotSep() {
  return (
    <span className="ui-dot-sep" aria-hidden>
      ·
    </span>
  );
}

/** Quiet bordered ghost-pill for the "Back to home" nav link — one consistent placement. */
function BackHomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
      Back to home
    </Link>
  );
}

/** Brand lockup — one consistent header treatment across every auth state. */
function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Oblixa home"
      className="inline-flex items-center gap-2.5 rounded-full no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span className="ui-avatar-tile h-8 w-8 text-[15px] font-bold text-[var(--accent-fg)] shadow-[var(--shadow-1)] [background:linear-gradient(180deg,var(--accent),var(--accent-strong))]">
        O
      </span>
      <span className="text-[17px] font-bold tracking-tight text-[var(--text-primary)]">Oblixa</span>
    </Link>
  );
}

/** Icon-led text field — one consistent anatomy for every non-password input. */
function IconField({
  id,
  name,
  label,
  hint,
  icon: Icon,
  type = "text",
  autoComplete,
  required,
  autoFocus,
  inputClassName = "",
  invalid,
  describedById,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  inputClassName?: string;
  invalid?: boolean;
  describedById?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="ui-label">
        {label}
        {hint ? <span className="ml-1 font-normal text-[var(--text-tertiary)]">{hint}</span> : null}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.85} />
        </span>
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`ui-input pl-10 ${inputClassName}`.trim()}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? describedById : undefined}
        />
      </div>
    </div>
  );
}

/** Password field with a consistent, accessible show/hide control. */
function PasswordField({
  id,
  name,
  label,
  requirementHint,
  autoComplete,
  autoFocus,
  show,
  onToggle,
  toggleShowLabel,
  toggleHideLabel,
  labelAccessory,
  invalid,
  describedById,
}: {
  id: string;
  name: string;
  label: string;
  /** Concise password requirement, rendered as a helper line below the input
   *  (kept out of the label so the accessible name stays exactly `label`). */
  requirementHint?: string;
  autoComplete: string;
  autoFocus?: boolean;
  show: boolean;
  onToggle: () => void;
  toggleShowLabel: string;
  toggleHideLabel: string;
  labelAccessory?: ReactNode;
  invalid?: boolean;
  describedById?: string;
}) {
  const reqId = `${id}-req`;
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1">
        <label htmlFor={id} className="ui-label col-start-1 row-start-1">
          {label}
        </label>
        <div className="col-span-2 row-start-2">
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
              aria-hidden
            >
              <KeyRound className="h-4 w-4" strokeWidth={1.85} />
            </span>
            <input
              id={id}
              name={name}
              type={show ? "text" : "password"}
              required
              minLength={8}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              className="ui-input pl-10 pr-12"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? describedById : requirementHint ? reqId : undefined}
            />
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={show}
              aria-label={show ? toggleHideLabel : toggleShowLabel}
              className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_60%,transparent)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {show ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              )}
            </button>
          </div>
          {requirementHint ? (
            <p id={reqId} className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
              {requirementHint}
            </p>
          ) : null}
        </div>
        {labelAccessory ? <div className="col-start-2 row-start-1 justify-self-end">{labelAccessory}</div> : null}
      </div>
    </div>
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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const path = state?.redirectTo;
    if (!path) return;
    // Reset shows a completion card with an explicit "continue" action rather
    // than navigating away silently; every other mode redirects immediately.
    if (mode === "reset-password") return;
    assignNavigableHref(path);
  }, [state, mode]);

  const c = config[mode];
  const formErrorId = "auth-form-error";
  const showFormError = Boolean(state?.error);
  const showProof = mode === "login" || mode === "signup";
  const showNote = Boolean(c.note);
  const NoteIcon = ShieldCheck;
  const isInvalidLink = mode === "reset-password" && linkInvalid;
  const isResetComplete = mode === "reset-password" && Boolean(state?.redirectTo) && !isInvalidLink;
  const isSuccess = Boolean(state?.success) && !isInvalidLink && !isResetComplete;
  const effectiveSignupGrantState =
    mode === "signup" ? signupGrantState ?? (accessCode ? "valid_workspace_creation" : "missing") : undefined;
  const blocksSignupForm =
    mode === "signup" && effectiveSignupGrantState !== "valid_workspace_creation";
  const togglePassword = () => setShowPassword((v) => !v);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);

    // Reset flow: confirm-password match is a client concern (the action only reads `password`).
    if (mode === "reset-password") {
      const pw = String(formData.get("password") ?? "");
      const confirm = String(formData.get("confirmPassword") ?? "");
      if (pw !== confirm) {
        setState({ error: "Passwords do not match." });
        return;
      }
    }

    setState(undefined);
    startTransition(async () => {
      setState(await runAuthAction(mode, formData));
    });
  }

  const factList = (className: string) => (
    <ul className={className}>
      {PRODUCT_FACTS.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2.5 text-[12.5px] text-[var(--text-secondary)]">
          <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
          <span className="leading-[1.35]">{label}</span>
        </li>
      ))}
    </ul>
  );

  /* Secondary product column — de-carded so the form is the single focal surface.
     The review-queue preview is the one framed surface here (no card-in-card). */
  const productPanel = (
    <section className="hidden min-w-0 lg:block" aria-label="What Oblixa does">
      <p>
        <span className="landing-eyebrow-dot text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          Contract tracking
        </span>
      </p>
      <h2 className="mt-3 max-w-[18ch] text-[1.5rem] font-semibold leading-[1.12] tracking-tight text-[var(--text-primary)] xl:text-[1.7rem]">
        Track what signed contracts require next.
      </h2>
      <p className="mt-3 max-w-md text-[13px] leading-[1.6] text-[var(--text-secondary)]">
        Upload signed agreements or import your tracker, then turn reviewed dates, owners,
        obligations, evidence, and exceptions into accountable work and exportable reports.
      </p>

      {/* Decorative product surface sample — hidden from assistive tech, no focusable controls.
          Deliberately low-weight (no shadow, softer surface) so the sign-in form stays focal. */}
      <div
        aria-hidden
        className="mt-6 rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,var(--surface))] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />
            Review queue
          </span>
          <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">Acme MSA</span>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[var(--surface)] text-[var(--text-tertiary)]">
            <CalendarClock className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Notice deadline</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
              Due Aug 14, 2026<DotSep />60-day notice
            </p>
          </div>
          <StatusBadge status="in_review" className="shrink-0">
            Suggested
          </StatusBadge>
        </div>

        <div className="mt-3 rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[var(--surface)] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;…providing{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_55%,transparent)] px-1 text-[var(--accent-strong)]">
            sixty (60) days
          </span>{" "}
          written notice…&rdquo;
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
          <span className="inline-flex items-center gap-2">
            <StatusBadge status="healthy">Reviewed</StatusBadge>
            <span className="text-[11px] text-[var(--text-tertiary)]">2d ago</span>
          </span>
          <span className="ui-caps-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[color:color-mix(in_oklab,var(--accent)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent)_8%,var(--surface-raised))] px-2.5 py-1 text-[10.5px] text-[var(--accent-strong)]">
            Open
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pt-5">
        {factList("grid grid-cols-2 gap-x-6 gap-y-3")}
      </div>
    </section>
  );

  const denied = mode === "signup" && state?.error?.includes("approved workspace access");

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showNote ? (
        <p className="flex items-start gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-4 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          <NoteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
          <span>{c.note}</span>
        </p>
      ) : null}

      {urlBanner ? (
        <div className="ui-alert-warning" role="alert">
          {urlBanner}
        </div>
      ) : null}
      {mode === "signup" && effectiveSignupGrantState === "valid_workspace_creation" ? (
        <div className="ui-alert-success" role="status">
          Access link ready. Create the account using the email this link was issued for.
        </div>
      ) : null}
      {state?.error ? (
        <div
          id={formErrorId}
          role="alert"
          aria-live="assertive"
          className="ui-alert-error flex items-start gap-2"
        >
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

      {mode === "signup" ? (
        <div className="space-y-4">
          <input type="hidden" name="accessCode" value={accessCode} />
          <IconField id="fullName" name="fullName" label="Full name" icon={User} required autoComplete="name" />
          <IconField
            id="companyName"
            name="companyName"
            label="Company name"
            hint="(optional)"
            icon={Users}
            autoComplete="organization"
          />
        </div>
      ) : null}

      {mode !== "reset-password" ? (
        <IconField
          id="email"
          name="email"
          label="Email"
          icon={Mail}
          type="email"
          required
          autoComplete="email"
          autoFocus={mode === "login" || mode === "forgot-password"}
          inputClassName="font-mono text-[13px]"
          invalid={showFormError}
          describedById={formErrorId}
        />
      ) : null}

      {mode === "login" || mode === "signup" ? (
        <PasswordField
          id="password"
          name="password"
          label="Password"
          requirementHint={mode === "signup" ? "Use at least 8 characters." : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          show={showPassword}
          onToggle={togglePassword}
          toggleShowLabel="Show password"
          toggleHideLabel="Hide password"
          invalid={showFormError}
          describedById={formErrorId}
          labelAccessory={
            mode === "login" ? (
              <Link
                href="/forgot-password"
                className="rounded-sm text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Forgot password?
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {mode === "reset-password" ? (
        <>
          <PasswordField
            id="password"
            name="password"
            label="New password"
            requirementHint="Use at least 8 characters you don't reuse."
            autoComplete="new-password"
            autoFocus
            show={showPassword}
            onToggle={togglePassword}
            toggleShowLabel="Show password"
            toggleHideLabel="Hide password"
            invalid={showFormError}
            describedById={formErrorId}
          />
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            show={showPassword}
            onToggle={togglePassword}
            toggleShowLabel="Show confirmation"
            toggleHideLabel="Hide confirmation"
            invalid={showFormError}
            describedById={formErrorId}
          />
        </>
      ) : null}

      <div className="space-y-2">
        <button
          type="submit"
          disabled={pending}
          className="ui-btn-primary h-12 w-full text-[14px]"
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.85} aria-hidden />
              {pendingLabel[mode]}
            </>
          ) : (
            c.submitLabel
          )}
        </button>

        {mode === "login" || mode === "signup" ? (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <ShieldCheck className="h-3 w-3" strokeWidth={1.85} aria-hidden />
            <span>
              Encrypted in transit<DotSep />Workspace-scoped sessions
            </span>
          </p>
        ) : null}
      </div>
    </form>
  );

  const stateCard = (
    accent: "success" | "warning",
    icon: LucideIcon,
    heading: string,
    body: string,
    actions: ReactNode
  ) => {
    const Icon = icon;
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
          style={{
            borderColor: `color-mix(in oklab, var(--${accent}) 26%, var(--border-subtle))`,
            background: `color-mix(in oklab, var(--${accent}-soft) 30%, var(--surface-raised))`,
            color: `var(--${accent}-ink)`,
          }}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.85} />
        </span>
        <div>
          <h2 className="text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">{heading}</h2>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {body}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
      </div>
    );
  };

  const successContent = stateCard(
    "success",
    MailCheck,
    mode === "signup" ? "Confirm your email" : "Check your email",
    mode === "signup"
      ? state?.success ?? ""
      : "If an account exists for that address, a password reset link is on its way.",
    <Link
      href="/login"
      className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px]"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
      Back to sign in
    </Link>
  );

  const resetCompleteContent = stateCard(
    "success",
    CircleCheck,
    "Password updated",
    "Your password is set and you're signed in to your workspace.",
    <Link href={state?.redirectTo ?? "/dashboard"} className="ui-btn-primary h-10 rounded-full px-4 text-[13px]">
      Continue to your workspace
    </Link>
  );

  const invalidLinkContent = stateCard(
    "warning",
    TriangleAlert,
    "This reset link is invalid or expired",
    "Request a new link to set your password.",
    <>
      <Link href="/forgot-password" className="ui-btn-primary h-10 rounded-full px-4 text-[13px]">
        Request a new link
      </Link>
      <Link href="/login" className="ui-btn-ghost rounded-full px-3.5 py-1.5 text-[12.5px]">
        Back to sign in
      </Link>
    </>
  );

  const signupGrantRecoveryContent = (() => {
    if (!blocksSignupForm) return null;

    const recoveryAction = {
      "request-access": { href: "/request-access", label: "Request access" },
      "sign-in": { href: "/login", label: "Sign in" },
      contact: { href: "/contact", label: "Contact support" },
    } as const;
    type RecoveryActionKey = keyof typeof recoveryAction;

    const recovery: Record<
      Exclude<NonNullable<typeof effectiveSignupGrantState>, "valid_workspace_creation">,
      { heading: string; body: string; primary: RecoveryActionKey; secondary: RecoveryActionKey }
    > = {
      missing: {
        heading: "Access link required",
        body: "Signup opens after workspace access is approved or an invite is issued.",
        primary: "request-access",
        secondary: "sign-in",
      },
      invalid: {
        heading: "Access link not recognized",
        body: "This link can't be used to create a workspace account. Request access to continue.",
        primary: "request-access",
        secondary: "sign-in",
      },
      expired: {
        heading: "Access link expired",
        body: "Request a new access link to create your workspace account.",
        primary: "request-access",
        secondary: "contact",
      },
      revoked: {
        heading: "Access link no longer active",
        body: "This link was revoked. Request access again or ask for a new invite.",
        primary: "request-access",
        secondary: "contact",
      },
      used: {
        heading: "Access link already used",
        body: "This link already created an account. Sign in, or request a new invite.",
        primary: "sign-in",
        secondary: "request-access",
      },
      unavailable: {
        heading: "Access check unavailable",
        body: "We couldn't verify this link right now. Try again shortly or request a fresh link.",
        primary: "request-access",
        secondary: "contact",
      },
    };

    const copy = recovery[effectiveSignupGrantState as keyof typeof recovery];
    const primary = recoveryAction[copy.primary];
    const secondary = recoveryAction[copy.secondary];

    return stateCard(
      "warning",
      TriangleAlert,
      copy.heading,
      copy.body,
      <>
        <Link href={primary.href} className="ui-btn-primary h-10 rounded-full px-4 text-[13px]">
          {primary.label}
        </Link>
        <Link href={secondary.href} className="ui-btn-ghost rounded-full px-3.5 py-1.5 text-[12.5px]">
          {secondary.label}
        </Link>
      </>
    );
  })();

  const cardBody = isInvalidLink
    ? invalidLinkContent
    : isResetComplete
      ? resetCompleteContent
      : isSuccess
        ? successContent
        : signupGrantRecoveryContent ?? formContent;
  const showAltLink =
    Boolean(c.altLink) &&
    !isSuccess &&
    !isInvalidLink &&
    !isResetComplete &&
    !signupGrantRecoveryContent;

  const authColumn = (
    <div className={showProof ? "min-w-0" : "w-full"}>
      <BrandMark />
      <div className="mb-3 mt-5">
        <p>
          <span className="ui-caps-2 text-[10px] text-[var(--text-tertiary)]">Workspace access</span>
        </p>
        <h1 className="mt-2 text-[1.5rem] font-semibold leading-[1.12] tracking-tight text-[var(--text-primary)] sm:text-[1.7rem]">
          {c.title}
        </h1>
        {c.intro ? (
          <p className="mt-2 max-w-[42ch] text-[13px] leading-[1.5] text-[var(--text-secondary)]">{c.intro}</p>
        ) : null}
      </div>

      <div className="landing-card-premium landing-card-static landing-card-rail relative overflow-hidden rounded-2xl border p-5 sm:p-6">
        {cardBody}
      </div>

      {showAltLink ? (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--surface-raised))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{c.altText}</p>
            {c.altHint ? <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">{c.altHint}</p> : null}
          </div>
          <Link
            href={c.altLink}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[color:color-mix(in_oklab,var(--accent)_30%,var(--border-subtle))] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--accent-strong)] transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_50%,var(--border-subtle))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,var(--surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:self-auto"
          >
            {c.altLinkText}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          </Link>
        </div>
      ) : null}

      {showProof ? factList("mt-6 grid grid-cols-1 gap-x-6 gap-y-2.5 min-[420px]:grid-cols-2 lg:hidden") : null}
    </div>
  );

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="landing-luminous landing-luminous--auth relative isolate flex min-h-0 flex-1 flex-col justify-start overflow-hidden px-4 pb-10 pt-10 outline-none sm:px-6 sm:pt-14"
    >
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      <div className={`mx-auto w-full ${showProof ? "max-w-[60rem]" : "max-w-[26rem]"}`}>
        <div className="mb-6">
          <BackHomeLink />
        </div>

        {showProof ? (
          <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_27.5rem] lg:items-start">
            {productPanel}
            {authColumn}
          </div>
        ) : (
          authColumn
        )}

        {/* Footer block kept with the content (legal links + notice) so it hugs the
            columns instead of floating at the viewport bottom; the luminous fills below. */}
        <div className="mt-12 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-6">
          <LegalLinks className="flex-wrap justify-center gap-x-4 gap-y-1.5" />
          <div className="mt-4">
            <AuthLegalFooter />
          </div>
        </div>
      </div>
    </main>
  );
}
