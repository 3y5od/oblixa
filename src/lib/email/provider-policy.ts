import { assertNoCrlfInHeaderValue } from "@/lib/email/list-unsubscribe-header";
import { redactOutboundMessageText } from "@/lib/messaging/outbound-payload-scrub";
import { redactSensitiveLogString } from "@/lib/observability/log-redaction";

export const EMAIL_PROVIDER_TIMEOUT_MS = 15_000;
export const EMAIL_AUTH_DNS_EXPECTATION_TYPES = ["SPF", "DKIM", "DMARC", "MX", "MTA-STS"] as const;

const EMAIL_SENDER_RE = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/;

export function assertValidEmailSender(value: string): void {
  assertNoCrlfInHeaderValue(value);
  if (!EMAIL_SENDER_RE.test(value.trim())) {
    throw new Error("invalid_email_sender");
  }
}

export function sanitizeEmailProviderFailure(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return redactOutboundMessageText(redactSensitiveLogString(message, 500), 500);
}

export function buildListUnsubscribeHeaders(input: {
  mailto?: string | null;
  oneClickUrl?: string | null;
}): Record<string, string> {
  const values = [input.mailto, input.oneClickUrl]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (values.length === 0) return {};
  for (const value of values) assertNoCrlfInHeaderValue(value);
  const headers: Record<string, string> = {
    "List-Unsubscribe": values.map((value) => `<${value}>`).join(", "),
  };
  if (input.oneClickUrl) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return headers;
}

export function summarizeEmailAuthDnsExpectations(records: Array<{ type: string; host: string; expected: string }>) {
  const foundTypes = new Set(records.map((record) => record.type.toUpperCase()));
  return EMAIL_AUTH_DNS_EXPECTATION_TYPES.map((type) => ({
    type,
    present: foundTypes.has(type),
  }));
}
