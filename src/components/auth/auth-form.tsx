"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  Check,
  FileCheck,
  KeyRound,
  Lock,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { assignNavigableHref } from "@/lib/navigation/client-navigation";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

interface AuthFormProps {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  /** Server-driven message (e.g. auth callback query errors) */
  urlBanner?: string;
}

type AuthState =
  | { error?: string; success?: string; redirectTo?: string }
  | undefined;

function authAction(mode: string) {
  return async (_prevState: AuthState, formData: FormData): Promise<AuthState> => {
    try {
      const mod = await import("@/actions/auth");
      switch (mode) {
        case "login":
          return mod.signIn(formData);
        case "signup":
          return mod.signUp(formData);
        case "forgot-password":
          return mod.forgotPassword(formData);
        case "reset-password":
          return mod.resetPassword(formData);
        default:
          return { error: "Invalid mode" };
      }
    } catch (error) {
      console.error("[auth-form] action failed", error);
      return { error: "Sign-in could not be completed. Refresh the page and try again." };
    }
  };
}

const config = {
  login: {
    title: "Sign in to your account",
    submitLabel: "Sign in",
    altText: "Don't have an account?",
    altLink: "/signup",
    altLinkText: "Start free trial",
    intro:
      "Continue managing contract deadlines, owners, work, evidence, and reports.",
  },
  signup: {
    title: "Start your free trial",
    submitLabel: "Start free trial",
    altText: "Already have an account?",
    altLink: "/login",
    altLinkText: "Sign in",
    intro:
      "Start by uploading a few signed agreements. You do not need to migrate everything at once.",
  },
  "forgot-password": {
    title: "Reset your password",
    submitLabel: "Send reset link",
    altText: "Remember your password?",
    altLink: "/login",
    altLinkText: "Sign in",
    intro: undefined,
  },
  "reset-password": {
    title: "Set a new password",
    submitLabel: "Update password",
    altText: "",
    altLink: "",
    altLinkText: "",
    intro: undefined,
  },
};

const pendingLabel: Record<AuthFormProps["mode"], string> = {
  login: "Signing in…",
  signup: "Creating account…",
  "forgot-password": "Sending link…",
  "reset-password": "Updating password…",
};

export function AuthForm({ mode, urlBanner }: AuthFormProps) {
  const [state, action, pending] = useActionState(authAction(mode), undefined);

  useEffect(() => {
    const path = state?.redirectTo;
    if (!path) return;
    assignNavigableHref(path);
  }, [state]);

  const c = config[mode];
  const formErrorId = "auth-form-error";
  const showFormError = Boolean(state?.error);

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="landing-luminous relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-16 outline-none sm:px-6"
    >
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      <div aria-hidden className="landing-luminous__grid" />
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_minmax(0,28rem)]">
        <section className="landing-card-premium landing-card-rail relative hidden min-h-[40rem] overflow-hidden rounded-3xl border p-10 lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden
            className="landing-corner-ring"
            style={{
              top: "-3.5rem",
              right: "-3.5rem",
              width: "11rem",
              height: "11rem",
            }}
          />
          <div className="relative">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />
              Back to home
            </Link>
            <p className="mt-10">
              <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Contract tracking
              </span>
            </p>
            <p className="ui-display-title mt-4 max-w-[14ch] text-[2.7rem] leading-[1.02]">
              Replace the contract tracking spreadsheet.
            </p>
            <p className="ui-muted mt-5 max-w-xl text-[14px]">
              Upload signed agreements, review key terms with source-backed extraction, assign owners and
              dates, and turn obligations into accountable work.
            </p>
          </div>

          <div className="relative my-8 rounded-2xl border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--surface-raised)_92%,var(--accent-soft))] p-5 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" aria-hidden />
                Today&apos;s queue
              </span>
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">Acme MSA · v3</span>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] text-[var(--accent-strong)]"
                aria-hidden
              >
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
                  Notice deadline · Aug 14, 2026
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">
                  60 days before renewal · owned by @priya
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_30%,var(--surface-raised))] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-strong)]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                AI · 94%
              </span>
            </div>
            <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
              &ldquo;…providing{" "}
              <span className="rounded-sm bg-[color:color-mix(in_oklab,var(--accent-soft)_60%,transparent)] px-1 text-[var(--accent-strong)]">
                sixty (60) days
              </span>{" "}
              written notice…&rdquo;
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <Check className="h-3 w-3 text-[var(--accent-strong)]" strokeWidth={3} aria-hidden />
                Approved · 2d ago
              </span>
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">notice.window</span>
            </div>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-2">
            {[
              { icon: FileCheck, label: "Source-backed field review" },
              { icon: BellRing, label: "Renewal and notice reminders" },
              { icon: CalendarClock, label: "Owners, obligations, and work" },
              { icon: Lock, label: "Reports and CSV export" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-start gap-2.5 rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_14%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-3.5 py-3 text-[14px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-1)]"
              >
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span className="leading-[1.35]">{label}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="mx-auto w-full max-w-[460px] lg:mx-0 lg:max-w-none">
          <nav className="mb-5 flex justify-center lg:hidden" aria-label="Site">
            <Link
              href="/"
              className="ui-btn-ghost inline-flex min-h-10 items-center gap-2 px-2 text-sm"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />
              Back to home
            </Link>
          </nav>
          <div className="mb-8 text-center sm:mb-9">
            <Link
              href="/"
              className="inline-flex items-center gap-3 no-underline transition-opacity hover:opacity-85"
            >
              <span className="ui-avatar-tile h-11 w-11 text-[var(--accent-fg)] shadow-[var(--shadow-2)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,white),var(--accent-strong))]">
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
            <p className="mt-5">
              <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Workspace access
              </span>
            </p>
            <h1 className="mx-auto mt-3 max-w-[28ch] text-pretty text-[1.75rem] font-semibold tracking-tight text-[var(--text-primary)] sm:mt-4 sm:text-[2rem]">
              {c.title}
            </h1>
            {c.intro ? (
              <p className="mx-auto mt-3 max-w-[36ch] text-pretty text-[13.5px] leading-[1.55] text-[var(--text-secondary)] sm:text-[14px]">
                {c.intro}
              </p>
            ) : null}
          </div>

          <div className="landing-card-premium relative overflow-hidden rounded-2xl border p-7 sm:p-9">
            <div
              aria-hidden
              className="landing-corner-ring"
              style={{
                top: "-2.25rem",
                right: "-2.25rem",
                width: "7rem",
                height: "7rem",
              }}
            />
            <form action={action} className="space-y-5">
              <div className="flex items-start gap-2.5 rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_16%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))] bg-[var(--surface-raised)] text-[var(--accent-strong)]"
                  aria-hidden
                >
                  <LockKeyhole className="h-3 w-3" />
                </span>
                <span>
                  Workspace sign-in keeps contract work, approvals, and reminders scoped to your organization.
                </span>
              </div>
              {urlBanner && (
                <div className="ui-alert-warning" role="alert">
                  {urlBanner}
                </div>
              )}
              {state?.error && (
                <div id={formErrorId} className="ui-alert-error" role="alert">
                  {state.error}
                </div>
              )}
              {state?.success && <div className="ui-alert-success">{state.success}</div>}

              {mode === "signup" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="ui-label">
                      Full name
                    </label>
                    <div className="relative">
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                        aria-hidden
                      >
                        <User className="h-4 w-4" />
                      </span>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        autoComplete="name"
                        className="ui-input pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="companyName" className="ui-label">
                      Company name <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
                    </label>
                    <div className="relative">
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                        aria-hidden
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        autoComplete="organization"
                        className="ui-input pl-10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {mode !== "reset-password" && (
                <div>
                  <label htmlFor="email" className="ui-label">
                    Email
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                      aria-hidden
                    >
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus={mode === "login" || mode === "forgot-password"}
                      className="ui-input pl-10"
                      aria-invalid={showFormError ? true : undefined}
                      aria-describedby={showFormError ? formErrorId : undefined}
                    />
                  </div>
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "reset-password") && (
                <div>
                  <label htmlFor="password" className="ui-label">
                    {mode === "reset-password" ? "New password" : "Password"}
                  </label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]"
                      aria-hidden
                    >
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      autoFocus={mode === "reset-password"}
                      className="ui-input pl-10"
                      aria-invalid={showFormError ? true : undefined}
                      aria-describedby={showFormError ? formErrorId : undefined}
                    />
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <Link href="/forgot-password" className="ui-link text-[12.5px]">
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="ui-btn-primary h-12 w-full text-[14px] shadow-[var(--shadow-1),0_12px_28px_-12px_color-mix(in_oklab,var(--accent-strong)_60%,transparent)]"
                aria-busy={pending}
              >
                {pending ? pendingLabel[mode] : c.submitLabel}
              </button>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3 w-3 text-[var(--accent-strong)]" aria-hidden />
                <span>Encrypted in transit · Workspace-scoped sessions</span>
              </div>
            </form>
          </div>

          {c.altLink && (
            <p className="mt-10 text-center text-[12.5px] text-[var(--text-secondary)]">
              {c.altText}{" "}
              <Link href={c.altLink} className="ui-link">
                {c.altLinkText}
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
