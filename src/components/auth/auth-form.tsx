"use client";

import { useActionState } from "react";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
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

export function AuthForm({ mode }: AuthFormProps) {
  const [state, action, pending] = useActionState(authAction(mode), undefined);
  const c = config[mode];

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">ContractOps</h1>
          <p className="mt-2 text-sm text-zinc-500">{c.title}</p>
        </div>

        <div className="ui-card p-8">
          <form action={action} className="space-y-5">
            {state?.error && (
              <div className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-sm text-red-800">
                {state.error}
              </div>
            )}
            {state?.success && (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
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
                  className="ui-input"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <Link href="/forgot-password" className="ui-link text-sm">
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="ui-btn-primary w-full py-2.5"
            >
              {pending ? "…" : c.submitLabel}
            </button>
          </form>
        </div>

        {c.altLink && (
          <p className="mt-8 text-center text-sm text-zinc-500">
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
