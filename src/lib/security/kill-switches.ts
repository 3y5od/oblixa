import { NextResponse } from "next/server";
import { jsonProblem } from "@/lib/http/problem";

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

export function isKillOutboundEmail(): boolean {
  return process.env.OBLIXA_KILL_OUTBOUND_EMAIL === "1";
}

export function isKillCronFamily(): boolean {
  return process.env.OBLIXA_KILL_CRON_FAMILY === "1";
}

export function isKillImportExport(): boolean {
  return process.env.OBLIXA_KILL_IMPORT_EXPORT === "1";
}

export function isKillIntegrationSync(): boolean {
  return process.env.OBLIXA_KILL_INTEGRATION_SYNC === "1";
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
  return jsonProblem(503, {
    error: "Service temporarily unavailable",
    code: "service_temporarily_unavailable",
    diagnostic_id: "kill_switch_active",
    details: { subsystem },
  });
}

export function killSwitchOperationalTelemetry(subsystem: string) {
  return {
    event: "operational.kill_switch_active",
    subsystem,
    severity: "warning",
    redaction: "metadata-only",
  } as const;
}

export function killSwitchAccessibleState(subsystem: string) {
  return {
    status: "paused",
    heading: "Temporarily unavailable",
    reason: "operator_kill_switch",
    subsystem,
  } as const;
}
