import { NextResponse } from "next/server";

/** Operator kill-switches for incident response (503 + stable JSON). */

export function isKillSignup(): boolean {
  return process.env.OBLIXA_KILL_SIGNUP === "1";
}

export function isKillBilling(): boolean {
  return process.env.OBLIXA_KILL_BILLING === "1";
}

export function isKillExtraction(): boolean {
  return process.env.OBLIXA_KILL_EXTRACTION === "1";
}

export function isKillInvites(): boolean {
  return process.env.OBLIXA_KILL_INVITES === "1";
}

export function isKillInboundAutomation(): boolean {
  return process.env.OBLIXA_KILL_INBOUND_AUTOMATION === "1";
}

/** Pauses outbound webhook worker cron (`/api/webhooks/dispatch`). */
export function isKillWebhookDispatch(): boolean {
  return process.env.OBLIXA_KILL_WEBHOOK_DISPATCH === "1";
}

export function killSwitchJsonResponse(subsystem: string): NextResponse {
  return NextResponse.json(
    { error: "Service temporarily unavailable", subsystem },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
