import {
  ClipboardCheck,
  Download,
  FileCheck,
  FileText,
  KeyRound,
  LockKeyhole,
  LogIn,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatSpecMonthlyPriceLabel } from "@/lib/billing/spec-prices";

export type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

/** Canonical public Core price label, derived from the billing module (never hardcoded). */
export const CORE_PRICE_LABEL = formatSpecMonthlyPriceLabel();

export interface AuthCallout {
  /** Lead question, e.g. "Need a workspace?" */
  text: string;
  /** Optional supporting line under the lead. */
  hint?: string;
  /** Optional structured caps facts (replaces the prose hint when present). */
  facts?: string[];
  link: string;
  linkText: string;
  /** Render the structured Core price chip alongside the callout (login only). */
  showPrice?: boolean;
}

export interface AuthModeConfig {
  /** Page-identity medallion icon (canonical icon-tile pattern §2.4). */
  icon: LucideIcon;
  eyebrow: string;
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
    eyebrow: "Workspace sign-in",
    title: "Sign in to your workspace.",
    intro: "Continue to contracts, owners, dates, tasks, evidence, and reports.",
    submit: "Sign in",
    pending: "Signing in…",
    callout: {
      text: "Need a workspace?",
      facts: ["No account", "No card", "After approval"],
      link: "/request-access",
      linkText: "Request access",
      showPrice: true,
    },
  },
  signup: {
    icon: UserPlus,
    eyebrow: "Workspace access",
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
    eyebrow: "Account recovery",
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
    eyebrow: "Account recovery",
    title: "Set a new password",
    intro: "Choose a new password for your workspace account.",
    submit: "Update password",
    pending: "Updating password…",
  },
};

export const PRODUCT_COPY = {
  icon: FileText,
  eyebrow: "Contract tracking",
  // Returning-user line — not the public landing promise (§10.15) and not a
  // restatement of the auth H1; it names the surface the user is coming back to.
  heading: "Return to signed-contract follow-up.",
  support: "Confirmed details become owners, dates, tasks, evidence, and reports.",
};

export interface ProductFact {
  icon: LucideIcon;
  label: string;
}

/** Compact product facts mapped to Core release surfaces. */
export const PRODUCT_FACTS: ProductFact[] = [
  { icon: FileCheck, label: "Confirm details" },
  { icon: Users, label: "Track tasks" },
  { icon: ClipboardCheck, label: "Collect evidence" },
  { icon: Download, label: "Export reports" },
];
