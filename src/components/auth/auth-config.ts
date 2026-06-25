import {
  KeyRound,
  LockKeyhole,
  LogIn,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

export interface AuthCallout {
  /** Lead, e.g. "Already have an account?" — cross-auth navigation only. */
  text: string;
  /** Optional supporting line under the lead. */
  hint?: string;
  link: string;
  linkText: string;
}

export interface AuthModeConfig {
  /** Page-identity medallion icon (canonical icon-tile pattern §2.4). */
  icon: LucideIcon;
  title: string;
  intro: string;
  submit: string;
  pending: string;
  /** Optional neutral status chip in the header (e.g. signup grant-gating). */
  headerChip?: string;
  /** Optional top-of-card note (forgot/signup context). */
  note?: string;
  callout?: AuthCallout;
}

export const MODE_CONFIG: Record<AuthMode, AuthModeConfig> = {
  login: {
    icon: LogIn,
    title: "Sign in to your workspace.",
    intro: "Enter your email and password to continue.",
    submit: "Sign in",
    pending: "Signing in…",
  },
  signup: {
    icon: UserPlus,
    title: "Create your workspace account",
    intro: "Finish creating your account from an approved workspace access link.",
    submit: "Create workspace account",
    pending: "Creating account…",
    headerChip: "Approved link required",
    note: "Signup is limited to approved workspace access links. Team invites are accepted from the invite email or after sign-in.",
    callout: {
      text: "Already have an account?",
      link: "/login",
      linkText: "Sign in",
    },
  },
  "forgot-password": {
    icon: KeyRound,
    title: "Reset your password",
    intro: "Enter your workspace email to get a reset link.",
    submit: "Send reset link",
    pending: "Sending link…",
    note: "For your security, we never reveal whether an email has an account.",
    callout: {
      text: "Remember your password?",
      link: "/login",
      linkText: "Sign in",
    },
  },
  "reset-password": {
    icon: LockKeyhole,
    title: "Set a new password",
    intro: "Choose a new password for your workspace account.",
    submit: "Update password",
    pending: "Updating password…",
  },
};
