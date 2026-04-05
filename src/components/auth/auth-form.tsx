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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ContractOps</h1>
          <p className="mt-2 text-sm text-gray-600">{c.title}</p>
        </div>

        <form action={action} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              {state.success}
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {mode !== "reset-password" && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode === "reset-password") && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {mode === "reset-password" ? "New password" : "Password"}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {mode === "login" && (
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {pending ? "..." : c.submitLabel}
          </button>
        </form>

        {c.altLink && (
          <p className="mt-6 text-center text-sm text-gray-600">
            {c.altText}{" "}
            <Link href={c.altLink} className="font-medium text-blue-600 hover:text-blue-500">
              {c.altLinkText}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
