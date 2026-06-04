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
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CircleCheck,
  Eye,
  EyeOff,
  FileCheck,
  KeyRound,
  Loader2,
  Lock,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  forgotPassword,
  resetPassword,
  signIn,
  signUp,
} from "@/actions/auth";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

interface AuthFormProps {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  /** Server-driven message (e.g. auth callback query errors) */
  urlBanner?: string;
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
    altText: "Don't have an account?",
    altLink: "/early-access",
    altLinkText: "Request access",
    intro: "Continue managing contract deadlines, owners, work, evidence, and reports.",
    notice: "Workspace sign-in keeps contract work, approvals, and reminders scoped to your organization.",
  },
  signup: {
    title: "Founder-led early access",
    submitLabel: "Request workspace access",
    altText: "Already have an account?",
    altLink: "/login",
    altLinkText: "Sign in",
    intro:
      "Oblixa is in founder-led early access. Request access if your team is replacing a contract-tracking spreadsheet.",
    notice: "Access is limited to invited workspaces during early access.",
  },
  "forgot-password": {
    title: "Reset your password",
    submitLabel: "Send reset link",
    altText: "Remember your password?",
    altLink: "/login",
    altLinkText: "Sign in",
    intro: "Enter your workspace email and we'll send a reset link if an account exists.",
    notice: "We never reveal whether an email has an account.",
  },
  "reset-password": {
    title: "Set a new password",
    submitLabel: "Update password",
    altText: "",
    altLink: "",
    altLinkText: "",
    intro: "Choose a new password for your workspace account.",
    notice: "Choose a strong password you don't reuse on other sites.",
  },
};

const pendingLabel: Record<AuthFormProps["mode"], string> = {
  login: "Signing in…",
  signup: "Creating account…",
  "forgot-password": "Sending link…",
  "reset-password": "Updating password…",
};

/** Source-backed product proof, shown in the desktop side panel and as a
 *  compact strip on mobile so small screens still carry product context. */
const PROOF_FEATURES = [
  { icon: FileCheck, label: "Source-backed field review" },
  { icon: BellRing, label: "Renewal and notice reminders" },
  { icon: CalendarClock, label: "Owners, obligations, and work" },
  { icon: Lock, label: "Reports and CSV export" },
];

/** Approved caps-token separator (§2.9 Tactic C) — never a bare middle dot. */
function DotSep() {
  return (
    <span className="ui-dot-sep" aria-hidden>
      ·
    </span>
  );
}

/** Quiet bordered pill for the "Back to home" nav link (reads as intentional, not plain text). */
function BackHomeLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${className}`.trim()}
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
      Back to home
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
  labelHint,
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
  labelHint?: string;
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
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1">
        <label htmlFor={id} className="ui-label col-start-1 row-start-1">
          {label}
          {labelHint ? (
            <span className="ml-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {labelHint}
            </span>
          ) : null}
        </label>
        <div className="relative col-span-2 row-start-2">
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
            aria-describedby={invalid ? describedById : undefined}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={show}
            aria-label={show ? toggleHideLabel : toggleShowLabel}
            className="absolute inset-y-1 right-1 inline-flex w-10 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_60%,transparent)] hover:text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {show ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.85} aria-hidden />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.85} aria-hidden />
            )}
          </button>
        </div>
        {labelAccessory ? <div className="col-start-2 row-start-1">{labelAccessory}</div> : null}
      </div>
    </div>
  );
}

export function AuthForm({ mode, urlBanner, linkInvalid = false }: AuthFormProps) {
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
  const isInvalidLink = mode === "reset-password" && linkInvalid;
  const isResetComplete = mode === "reset-password" && Boolean(state?.redirectTo) && !isInvalidLink;
  const isSuccess = Boolean(state?.success) && !isInvalidLink && !isResetComplete;
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

  const proofPanel = (
    <section className="relative hidden overflow-hidden rounded-3xl border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] p-7 shadow-[var(--shadow-1)] lg:flex lg:flex-col lg:justify-center lg:gap-6">
      <div>
        <BackHomeLink />
        <p className="mt-6">
          <span className="landing-eyebrow-dot text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Contract tracking
          </span>
        </p>
        <p className="ui-display-title mt-3 max-w-[20ch]">
          Replace your <span className="whitespace-nowrap">contract-tracking</span> spreadsheet.
        </p>
        <p className="ui-muted mt-3 max-w-md text-[13.5px]">
          Upload signed agreements, then turn source-backed suggestions you review into owners,
          dates, renewals, and accountable work.
        </p>
      </div>

      <div className="relative rounded-2xl border border-[color:color-mix(in_oklab,var(--border-subtle)_65%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_70%,transparent)] p-4">
        <div className="flex items-center justify-between">
          <span className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
            Review queue
          </span>
          <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">Acme MSA</span>
        </div>
        <div className="mt-3 flex items-start gap-2.5">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_34%,var(--surface-raised))] text-[var(--accent-strong)]"
            aria-hidden
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
              Notice deadline<DotSep />Aug 14, 2026
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
              60 days before renewal<DotSep />owned by @priya
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_28%,var(--surface-raised))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-strong)]">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={1.85} aria-hidden />
            Suggested
          </span>
        </div>
        <div className="mt-2.5 rounded-md border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-[var(--text-secondary)]">
          &ldquo;…providing{" "}
          <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
            sixty (60) days
          </span>{" "}
          written notice…&rdquo;
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-2.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
            <Check className="h-3 w-3 text-[var(--success-ink)]" strokeWidth={2.4} aria-hidden />
            Reviewed<DotSep />2d ago
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded border border-[color:color-mix(in_oklab,var(--border-subtle)_75%,transparent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
              notice.window
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
              Open
              <ArrowRight className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
            </span>
          </span>
        </div>
      </div>

      <ul className="relative grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {PROOF_FEATURES.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]">
            <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
            <span className="leading-[1.35]">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  const denied = mode === "signup" && state?.error?.includes("founder-led early access");

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2.5 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] pb-4 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        <LockKeyhole
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
          strokeWidth={1.85}
          aria-hidden
        />
        <span>{c.notice}</span>
      </div>

      {urlBanner && (
        <div className="ui-alert-warning" role="alert">
          {urlBanner}
        </div>
      )}
      {state?.error && (
        <div id={formErrorId} className="ui-alert-error" role="alert">
          {state.error}
          {denied ? (
            <Link
              href="/early-access"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-strong)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_24%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Request early access
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </Link>
          ) : null}
        </div>
      )}

      {mode === "signup" && (
        <div className="space-y-4">
          <IconField
            id="accessCode"
            name="accessCode"
            label="Access code"
            hint="from your invite"
            icon={LockKeyhole}
            autoComplete="off"
          />
          <IconField id="fullName" name="fullName" label="Full name" icon={User} required autoComplete="name" />
          <IconField
            id="companyName"
            name="companyName"
            label="Company name"
            hint="(optional)"
            icon={ShieldCheck}
            autoComplete="organization"
          />
        </div>
      )}

      {mode !== "reset-password" && (
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
      )}

      {(mode === "login" || mode === "signup") && (
        <PasswordField
          id="password"
          name="password"
          label="Password"
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
                className="ui-link rounded text-[12px] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Forgot password?
              </Link>
            ) : undefined
          }
        />
      )}

      {mode === "reset-password" && (
        <>
          <PasswordField
            id="password"
            name="password"
            label="New password"
            labelHint="min 8"
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
      )}

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

      <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-[var(--text-tertiary)]">
        <ShieldCheck className="h-3 w-3 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <span>
          Encrypted in transit<DotSep />Workspace-scoped sessions
        </span>
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
    mode === "signup" ? "Confirm your email" : "Reset link sent",
    state?.success ?? "",
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

  const cardBody = isInvalidLink
    ? invalidLinkContent
    : isResetComplete
      ? resetCompleteContent
      : isSuccess
        ? successContent
        : formContent;
  const showAltLink = Boolean(c.altLink) && !isSuccess && !isInvalidLink && !isResetComplete;

  const authColumn = (
    <div
      className={`flex w-full flex-col ${
        showProof ? "mx-auto max-w-[26rem] lg:mx-0 lg:max-w-none" : "mx-auto max-w-[26rem]"
      }`}
    >
      <nav className={`mb-5 flex justify-center ${showProof ? "lg:hidden" : ""}`} aria-label="Site">
        <BackHomeLink />
      </nav>

      <div className="mb-4 text-center sm:mb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-3 no-underline transition-opacity hover:opacity-85"
        >
          <span className="ui-avatar-tile h-11 w-11 text-[var(--accent-fg)] shadow-[var(--shadow-2)] [background:linear-gradient(180deg,var(--accent),var(--accent-strong))]">
            O
          </span>
          <span
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--text-primary) 0%, color-mix(in oklab, var(--text-primary) 68%, var(--accent-strong)) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.015em",
            }}
          >
            Oblixa
          </span>
        </Link>
        <p className="mt-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Workspace access
          </span>
        </p>
        <h1 className="mx-auto mt-2 max-w-[28ch] text-pretty text-[1.5rem] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.75rem]">
          {c.title}
        </h1>
        {c.intro ? (
          <p className="mx-auto mt-2.5 max-w-[38ch] text-pretty text-[13px] leading-[1.55] text-[var(--text-secondary)] sm:text-[13.5px]">
            {c.intro}
          </p>
        ) : null}
      </div>

      <div className="landing-card-premium landing-card-static relative overflow-hidden rounded-2xl border p-5 sm:p-6">
        {cardBody}

        {showAltLink && (
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] pt-5 text-center">
            <span className="text-[12px] text-[var(--text-tertiary)]">{c.altText}</span>
            <Link
              href={c.altLink}
              className="ui-btn-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--accent-strong)]"
            >
              {c.altLinkText}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
            </Link>
          </div>
        )}
      </div>

      {showProof && (
        <ul className="mt-8 grid grid-cols-1 gap-x-5 gap-y-3 min-[480px]:grid-cols-2 lg:hidden">
          {PROOF_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-[12.5px] text-[var(--text-secondary)]">
              <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
              <span className="leading-[1.35]">{label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="landing-luminous landing-luminous--quiet relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-6 outline-none sm:px-6"
    >
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      {showProof ? (
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-center">
          {proofPanel}
          {authColumn}
        </div>
      ) : (
        <div className="mx-auto w-full">{authColumn}</div>
      )}
    </main>
  );
}
