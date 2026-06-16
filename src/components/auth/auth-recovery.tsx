"use client";

import Link from "next/link";
import {
  Ban,
  Clock,
  KeyRound,
  RefreshCw,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AuthStateCard, type AuthStateTone } from "./auth-state-card";

export type SignupGrantState =
  | "valid_workspace_creation"
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "revoked"
  | "unavailable";

type RecoveryAction = "request-access" | "sign-in" | "contact";

export type RecoveryInfo = {
  chip: string;
  heading: string;
  body: string;
  tone: AuthStateTone;
  icon: LucideIcon;
  primary: RecoveryAction;
  secondary: RecoveryAction;
};

export const SIGNUP_RECOVERY: Record<Exclude<SignupGrantState, "valid_workspace_creation">, RecoveryInfo> = {
  missing: {
    chip: "No link",
    heading: "Access link required",
    body: "Signup opens after workspace access is approved or an invite is issued.",
    tone: "neutral",
    icon: KeyRound,
    primary: "request-access",
    secondary: "sign-in",
  },
  invalid: {
    chip: "Invalid",
    heading: "Access link not recognized",
    body: "This link can't be used to create a workspace account. Request access to continue.",
    tone: "warning",
    icon: XCircle,
    primary: "request-access",
    secondary: "sign-in",
  },
  expired: {
    chip: "Expired",
    heading: "Access link expired",
    body: "Request a new access link to create your workspace account.",
    tone: "warning",
    icon: Clock,
    primary: "request-access",
    secondary: "contact",
  },
  revoked: {
    chip: "Revoked",
    heading: "Access link no longer active",
    body: "This link was revoked. Request access again or ask for a new invite.",
    tone: "warning",
    icon: Ban,
    primary: "request-access",
    secondary: "contact",
  },
  used: {
    chip: "Used",
    heading: "Access link already used",
    body: "This link already created an account. Sign in, or request a new invite.",
    tone: "neutral",
    icon: RotateCcw,
    primary: "sign-in",
    secondary: "request-access",
  },
  unavailable: {
    chip: "Unavailable",
    heading: "Access check unavailable",
    body: "We couldn't verify this link right now. Try again shortly or request a fresh link.",
    tone: "warning",
    icon: RefreshCw,
    primary: "request-access",
    secondary: "contact",
  },
};

const RECOVERY_ACTION: Record<RecoveryAction, { href: string; label: string }> = {
  "request-access": { href: "/request-access", label: "Request access" },
  "sign-in": { href: "/login", label: "Sign in" },
  contact: { href: "/contact", label: "Contact support" },
};

export function SignupRecoveryCard({ recoveryInfo }: { recoveryInfo: RecoveryInfo }) {
  return (
    <AuthStateCard
      tone={recoveryInfo.tone}
      icon={recoveryInfo.icon}
      chip={recoveryInfo.chip}
      heading={recoveryInfo.heading}
      body={recoveryInfo.body}
    >
      <Link href={RECOVERY_ACTION[recoveryInfo.primary].href} className="ui-btn-primary">
        {RECOVERY_ACTION[recoveryInfo.primary].label}
      </Link>
      <Link href={RECOVERY_ACTION[recoveryInfo.secondary].href} className="ui-btn-ghost">
        {RECOVERY_ACTION[recoveryInfo.secondary].label}
      </Link>
    </AuthStateCard>
  );
}
