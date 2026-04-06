"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  /** Server-driven message (e.g. auth callback query errors) */
  urlBanner?: string;
}

type AuthState = { error?: string; success?: string } | undefined;

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
  const c = config[mode];

  return (
    <div
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col justify-center bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(30,58,95,0.08),transparent)] px-4 py-16 outline-none sm:px-6"
    >
      <div className="mx-auto w-full max-w-[420px]">
        <nav className="mb-6 flex justify-center" aria-label="Site">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-zinc-500 transition-colors hover:text-[var(--accent)]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to home
          </Link>
        </nav>
        <div className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
            ContractOps
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
            {c.title}
          </h1>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white/90 p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:p-9">
          <form action={action} className="space-y-5">
            {urlBanner && (
              <div
                className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[13px] font-medium text-amber-950"
                role="alert"
              >
                {urlBanner}
              </div>
            )}
            {state?.error && (
              <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-[13px] font-medium text-red-900">
                {state.error}
              </div>
            )}
            {state?.success && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-[13px] font-medium text-emerald-950">
                {state.success}
              </div>
            )}

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
