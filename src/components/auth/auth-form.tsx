"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  };
}

const config = {
  login: {
    title: "Sign in to your account",
    submitLabel: "Sign in",
    altText: "Don't have an account?",
    altLink: "/signup",
    altLinkText: "Sign up",
  },
  signup: {
    title: "Create your account",
    submitLabel: "Create account",
    altText: "Already have an account?",
    altLink: "/login",
    altLinkText: "Sign in",
  },
  "forgot-password": {
    title: "Reset your password",
    submitLabel: "Send reset link",
    altText: "Remember your password?",
    altLink: "/login",
    altLinkText: "Sign in",
  },
  "reset-password": {
    title: "Set a new password",
    submitLabel: "Update password",
    altText: "",
    altLink: "",
    altLinkText: "",
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
      className="flex min-h-0 flex-1 items-center justify-center px-4 py-16 outline-none sm:px-6"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_minmax(0,28rem)]">
        <section className="ui-card-hero hidden min-h-[44rem] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link href="/" className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Back to home
            </Link>
            <p className="ui-eyebrow mt-12">Contract operations OS</p>
            <p className="ui-display-title mt-4 max-w-[10ch] text-[2.9rem] leading-[1.02]">
              Post-signature work, finally in one place.
            </p>
            <p className="ui-muted mt-5 max-w-xl text-[15px]">
              Upload agreements, approve extraction, route approvals, manage obligations, and keep an audit-ready
              record of operational execution.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Evidence-backed field review",
              "Operational reminders and approvals",
              "Renewals, exceptions, and tasks",
              "Workspace-gated advanced and assurance surfaces",
            ].map((item) => (
              <div key={item} className="ui-support-panel px-4 py-4 text-sm font-medium text-[var(--text-secondary)]">
                {item}
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
              <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Back to home
            </Link>
          </nav>
          <div className="mb-8 text-center sm:mb-9">
            <Link href="/" className="inline-flex items-center gap-3 no-underline transition-opacity hover:opacity-85">
              <span className="ui-avatar-tile h-10 w-10 text-[var(--accent-fg)] shadow-[var(--shadow-2)] [background:linear-gradient(180deg,color-mix(in_oklab,var(--accent)_76%,white),var(--accent-strong))]">
                O
              </span>
              <span className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">Oblixa</span>
            </Link>
            <p className="ui-eyebrow mt-4">Workspace access</p>
            <h1 className="mx-auto mt-3 max-w-[28ch] text-pretty text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:mt-4 sm:text-[2rem]">
              {c.title}
            </h1>
          </div>

          <div className="ui-page-shell p-7 shadow-[var(--shadow-2)] sm:p-9">
            <form action={action} className="space-y-5">
              <div className="ui-surface-tint px-3.5 py-3 text-[12px] text-[var(--text-secondary)]">
                Workspace sign-in keeps post-signature execution, approvals, and reminders scoped to your organization.
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
                <div>
                  <label htmlFor="fullName" className="ui-label">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    className="ui-input"
                  />
                </div>
              )}

              {mode !== "reset-password" && (
                <div>
                  <label htmlFor="email" className="ui-label">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus={mode === "login" || mode === "forgot-password"}
                    className="ui-input"
                    aria-invalid={showFormError ? true : undefined}
                    aria-describedby={showFormError ? formErrorId : undefined}
                  />
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "reset-password") && (
                <div>
                  <label htmlFor="password" className="ui-label">
                    {mode === "reset-password" ? "New password" : "Password"}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    autoFocus={mode === "reset-password"}
                    className="ui-input"
                    aria-invalid={showFormError ? true : undefined}
                    aria-describedby={showFormError ? formErrorId : undefined}
                  />
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <Link href="/forgot-password" className="ui-link text-[13px]">
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="ui-btn-primary h-12 w-full text-[15px]"
                aria-busy={pending}
              >
                {pending ? pendingLabel[mode] : c.submitLabel}
              </button>
            </form>
          </div>

          {c.altLink && (
            <p className="mt-10 text-center text-[13px] text-[var(--text-secondary)]">
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
