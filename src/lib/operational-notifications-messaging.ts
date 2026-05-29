import { sanitizeOutboundHtml, redactOutboundMessageText } from "@/lib/messaging/outbound-payload-scrub";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";
import {
  RELEASE_STATE_EMAIL_TEMPLATE_KEYS,
  RELEASE_STATE_EMAIL_TEMPLATES,
  type ReleaseStateEmailTemplateKey,
} from "@/lib/release-state-email-templates";

export const OPERATIONAL_MESSAGE_SURFACE_IDS = [
  "email",
  "in_app_notification",
  "toast",
  "alert",
  "error",
  "banner",
  "reminder",
  "evidence_request",
  "billing_notice",
] as const;

export type OperationalMessageSurface = (typeof OPERATIONAL_MESSAGE_SURFACE_IDS)[number];

export type OperationalMessageSensitivity =
  | "operational_metadata"
  | "billing_metadata"
  | "support_metadata"
  | "security_metadata"
  | "notification_metadata";

export type OperationalUserFacingMessage = {
  id: string;
  surface: OperationalMessageSurface;
  owner: `@${string}`;
  trigger: string;
  source: string;
  sensitivityClass: OperationalMessageSensitivity;
  deliveryPolicy: "direct" | "preference_gated" | "digest_grouped" | "suppressed_or_retried";
  renderingPolicy: "escaped_html" | "plain_text" | "bounded_preview" | "sanitized_payload";
  testCoverage: string;
};

function lifecycleSurface(key: ReleaseStateEmailTemplateKey): OperationalMessageSurface {
  if (
    key.startsWith("trial_") ||
    key === "payment_succeeded" ||
    key === "payment_failed" ||
    key === "cancellation_confirmation"
  ) {
    return "billing_notice";
  }
  if (key.includes("reminder") || key.includes("renewal") || key.includes("deadline")) return "reminder";
  if (key.startsWith("evidence_")) return "evidence_request";
  return "email";
}

const RELEASE_STATE_MESSAGE_REGISTRY: OperationalUserFacingMessage[] = RELEASE_STATE_EMAIL_TEMPLATE_KEYS.map((key) => {
  const template = RELEASE_STATE_EMAIL_TEMPLATES[key];
  const surface = lifecycleSurface(key);
  return {
    id: `release_email.${key}`,
    surface,
    owner: surface === "billing_notice" ? "@billing" : "@notifications",
    trigger: template.key,
    source: "src/lib/release-state-email-templates.ts",
    sensitivityClass: surface === "billing_notice" ? "billing_metadata" : "operational_metadata",
    deliveryPolicy: surface === "reminder" || surface === "evidence_request" ? "preference_gated" : "direct",
    renderingPolicy: "plain_text",
    testCoverage: "src/lib/release-state-email-templates.test.ts",
  };
});

const NOTIFICATION_TAXONOMY_MESSAGE_REGISTRY: OperationalUserFacingMessage[] = NOTIFICATION_TAXONOMY.map((entry) => {
  const isReminder = /reminder|due|renewal|obligation/.test(entry.notificationType);
  const isEvidence = /^evidence_/.test(entry.notificationType);
  return {
    id: `notification.${entry.notificationType}`,
    surface: isEvidence ? "evidence_request" : isReminder ? "reminder" : "in_app_notification",
    owner: "@notifications",
    trigger: entry.notificationType,
    source: "src/lib/notification-taxonomy.ts",
    sensitivityClass: "notification_metadata",
    deliveryPolicy: entry.notificationType.includes("summary") ? "digest_grouped" : "preference_gated",
    renderingPolicy: "bounded_preview",
    testCoverage: "src/lib/notification-taxonomy.test.ts",
  };
});

export const OPERATIONAL_USER_FACING_MESSAGE_REGISTRY: OperationalUserFacingMessage[] = [
  ...RELEASE_STATE_MESSAGE_REGISTRY,
  ...NOTIFICATION_TAXONOMY_MESSAGE_REGISTRY,
  {
    id: "toast.settings.notifications_saved",
    surface: "toast",
    owner: "@notifications",
    trigger: "notification preference mutation success or failure",
    source: "src/actions/notifications.ts",
    sensitivityClass: "operational_metadata",
    deliveryPolicy: "direct",
    renderingPolicy: "plain_text",
    testCoverage: "src/actions/notifications.test.ts",
  },
  {
    id: "alert.notification_retry_health",
    surface: "alert",
    owner: "@notifications",
    trigger: "notification retry cron partial failure",
    source: "src/app/api/notifications/retry-deliveries/route.ts",
    sensitivityClass: "operational_metadata",
    deliveryPolicy: "suppressed_or_retried",
    renderingPolicy: "sanitized_payload",
    testCoverage: "src/app/api/notifications/retry-deliveries/route.test.ts",
  },
  {
    id: "error.notification_provider_failure",
    surface: "error",
    owner: "@notifications",
    trigger: "email or Slack provider delivery failure",
    source: "src/lib/notification-delivery.ts",
    sensitivityClass: "operational_metadata",
    deliveryPolicy: "suppressed_or_retried",
    renderingPolicy: "sanitized_payload",
    testCoverage: "src/lib/notification-delivery.test.ts",
  },
  {
    id: "banner.notifications_channel_off",
    surface: "banner",
    owner: "@notifications",
    trigger: "notification channel disabled or read-only settings state",
    source: "src/lib/settings/spec-strings.ts",
    sensitivityClass: "operational_metadata",
    deliveryPolicy: "direct",
    renderingPolicy: "plain_text",
    testCoverage: "src/actions/notifications.test.ts",
  },
  {
    id: "evidence.evidence_followup_owner",
    surface: "evidence_request",
    owner: "@notifications",
    trigger: "evidence follow-up cron owner notification",
    source: "src/app/api/cron/v4/evidence-followup/route.ts",
    sensitivityClass: "operational_metadata",
    deliveryPolicy: "preference_gated",
    renderingPolicy: "sanitized_payload",
    testCoverage: "src/app/api/cron/v4/evidence-followup/route.test.ts",
  },
];

export function validateOperationalUserFacingMessageRegistry(
  rows: OperationalUserFacingMessage[] = OPERATIONAL_USER_FACING_MESSAGE_REGISTRY
) {
  const issues: Array<{ issue: string; id?: string; surface?: string }> = [];
  const seen = new Set<string>();
  const surfaces = new Set<OperationalMessageSurface>();

  for (const row of rows) {
    if (seen.has(row.id)) issues.push({ issue: "duplicate_message_id", id: row.id });
    seen.add(row.id);
    surfaces.add(row.surface);
    if (!row.owner.startsWith("@")) issues.push({ issue: "missing_owner", id: row.id });
    if (!row.trigger.trim()) issues.push({ issue: "missing_trigger", id: row.id });
    if (!row.source.trim()) issues.push({ issue: "missing_source", id: row.id });
    if (!row.testCoverage.trim()) issues.push({ issue: "missing_test_coverage", id: row.id });
  }

  for (const surface of OPERATIONAL_MESSAGE_SURFACE_IDS) {
    if (!surfaces.has(surface)) issues.push({ issue: "missing_surface", surface });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    messageCount: rows.length,
    surfaceCount: surfaces.size,
  };
}

export type OperationalNotificationEligibilityInput = {
  notificationType: string;
  channelEnabled: boolean;
  blockedTypes?: readonly string[];
  quietHoursSuppressed?: boolean;
  orgStatus: "active" | "disabled" | "suspended";
  recipientStatus: "active" | "inactive" | "deleted";
  billingState: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  allowBillingException?: boolean;
  workspaceMode: "core" | "advanced" | "assurance";
  notificationTier: "core" | "advanced" | "assurance";
  featureFamily?: string | null;
  hiddenFeatureFamilies?: readonly string[];
  duplicateKey?: string | null;
  deliveredDeduplicationKeys?: readonly string[];
  rateLimitRemaining?: number;
  digestGrouping?: { mode: "immediate" | "digest"; groupKey?: string | null; pendingCount?: number };
};

export type OperationalNotificationEligibilityResult = {
  allowed: boolean;
  immediateSend: boolean;
  reasons: string[];
  digestGroupKey?: string | null;
};

const WORKSPACE_TIER_RANK = { core: 0, advanced: 1, assurance: 2 } as const;

export function evaluateOperationalNotificationEligibility(
  input: OperationalNotificationEligibilityInput
): OperationalNotificationEligibilityResult {
  const reasons: string[] = [];
  if (!input.channelEnabled || (input.blockedTypes ?? []).includes(input.notificationType)) reasons.push("opt_out");
  if (input.quietHoursSuppressed) reasons.push("quiet_hours");
  if (input.orgStatus !== "active") reasons.push("disabled_org");
  if (input.recipientStatus !== "active") reasons.push("inactive_user");
  if (
    input.billingState !== "active" &&
    input.billingState !== "trialing" &&
    !input.allowBillingException
  ) {
    reasons.push("billing_state");
  }
  if (WORKSPACE_TIER_RANK[input.workspaceMode] < WORKSPACE_TIER_RANK[input.notificationTier]) {
    reasons.push("workspace_mode");
  }
  if (input.featureFamily && (input.hiddenFeatureFamilies ?? []).includes(input.featureFamily)) {
    reasons.push("hidden_feature");
  }
  if (input.duplicateKey && (input.deliveredDeduplicationKeys ?? []).includes(input.duplicateKey)) {
    reasons.push("duplicate_suppression");
  }
  if (typeof input.rateLimitRemaining === "number" && input.rateLimitRemaining <= 0) {
    reasons.push("rate_limited");
  }
  if (input.digestGrouping?.mode === "digest" && (input.digestGrouping.pendingCount ?? 0) > 0) {
    reasons.push("digest_grouping");
  }

  return {
    allowed: reasons.length === 0,
    immediateSend: reasons.length === 0,
    reasons,
    digestGroupKey: input.digestGrouping?.groupKey ?? null,
  };
}

export type OperationalMessageFixtureInput = {
  recipientDisplayName?: string | null;
  entityName?: string | null;
  actionHref?: string | null;
  dueAt?: Date | string | null;
  locale?: string;
  timeZone?: string;
  unsubscribeHref?: string | null;
  markdownBody?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(value: string | null | undefined, fallback: string): string {
  const raw = redactOutboundMessageText(String(value ?? "").trim(), 1024);
  if (/^(?:https:\/\/|\/(?!\/))/i.test(raw)) return escapeHtml(raw);
  return fallback;
}

function formatOperationalDate(value: Date | string | null | undefined, locale: string, timeZone: string): string {
  const date = value ? new Date(value) : new Date("2026-01-01T12:00:00Z");
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
}

export function renderOperationalMessageFixture(input: OperationalMessageFixtureInput) {
  const name = redactOutboundMessageText(input.recipientDisplayName?.trim() || "there", 120);
  const entity = redactOutboundMessageText(input.entityName?.trim() || "this workspace item", 180);
  const due = formatOperationalDate(input.dueAt, input.locale ?? "en-US", input.timeZone ?? "UTC");
  const actionHref = safeHref(input.actionHref, "/dashboard");
  const unsubscribeHref = safeHref(input.unsubscribeHref, "/settings/product#notifications");
  const markdownBody = redactOutboundMessageText(input.markdownBody ?? "", 1000).replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const html = sanitizeOutboundHtml(`
    <p>Hello ${escapeHtml(name)},</p>
    <p>${escapeHtml(entity)} needs attention by ${escapeHtml(due)}.</p>
    <p>${escapeHtml(markdownBody || "Open the workspace for the latest status.")}</p>
    <p><a href="${actionHref}">Open workspace</a></p>
    <p><a href="${unsubscribeHref}">Manage notification preferences</a></p>
  `);

  return {
    subject: redactOutboundMessageText(`Action needed: ${entity}`, 240).replace(/[\r\n]+/g, " "),
    html,
    text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  };
}

export type OperationalRetryPolicyInput = {
  attemptCount: number;
  maxAttempts: number;
  errorClass: "none" | "provider_failure" | "transient_failure" | "permanent_failure";
  hasRetryPayload: boolean;
  duplicateDelivery: boolean;
  stale: boolean;
};

export function classifyOperationalNotificationRetry(input: OperationalRetryPolicyInput) {
  if (input.duplicateDelivery) {
    return { outcome: "suppressed_duplicate", retry: false, userImpact: "none", deadLetter: false };
  }
  if (input.stale) {
    return { outcome: "suppressed_stale", retry: false, userImpact: "none", deadLetter: false };
  }
  if (!input.hasRetryPayload) {
    return { outcome: "failed_dead_letter", retry: false, userImpact: "none", deadLetter: true };
  }
  if (input.errorClass === "none") {
    return { outcome: "delivered", retry: false, userImpact: "delivered", deadLetter: false };
  }
  if (input.errorClass === "permanent_failure") {
    return { outcome: "failed_dead_letter", retry: false, userImpact: "none", deadLetter: true };
  }
  const nextAttempt = Math.max(1, input.attemptCount + 1);
  if (nextAttempt >= Math.max(1, input.maxAttempts)) {
    return { outcome: "failed_dead_letter", retry: false, userImpact: "none", deadLetter: true };
  }
  return {
    outcome: "retrying",
    retry: true,
    userImpact: "none",
    deadLetter: false,
    backoffSeconds: Math.min(3600, Math.pow(2, nextAttempt) * 30),
  };
}
