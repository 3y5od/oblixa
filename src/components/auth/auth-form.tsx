"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    window.location.assign(path);
  }, [state]);

  const c = config[mode];
  const formErrorId = "auth-form-error";
  const showFormError = Boolean(state?.error);

  return (
    <div
      id="main-content"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col justify-center bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(30,58,95,0.08),transparent)] px-4 py-16 outline-none sm:px-6"
    >
      <div className="mx-auto w-full max-w-[420px]">
        <nav className="mb-5 flex justify-center" aria-label="Site">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to home
          </Link>
        </nav>
        <div className="mb-8 text-center sm:mb-9">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-zinc-950 no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] sm:text-3xl"
          >
            Oblixa
          </Link>
          <h1 className="mx-auto mt-4 max-w-[28ch] text-pretty text-lg font-medium leading-snug text-zinc-600 sm:mt-5 sm:text-xl">
            {c.title}
          </h1>
        </div>

        <div className="ui-card p-7 shadow-sm sm:p-9">
          <form action={action} className="space-y-5">
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
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
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
          <p className="mt-10 text-center text-[13px] text-zinc-500">
            {c.altText}{" "}
            <Link href={c.altLink} className="ui-link">
              {c.altLinkText}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
