import { deepRedactEmailLikeInUnknown, redactSensitiveLogString } from "@/lib/observability/log-redaction";
import { stripSensitiveUrlParams, urlContainsSensitiveParams } from "@/lib/security/sensitive-url";

const CSP_REPORT_STRING_MAX = 1024;
const CSP_REPORT_DIRECTIVE_RE = /^[a-z0-9][a-z0-9-]*(?:\s+[^;\r\n]{0,200})?$/i;

export type NormalizedCspReport = {
  documentUri: string | null;
  blockedUri: string | null;
  violatedDirective: string | null;
  effectiveDirective: string | null;
  disposition: "enforce" | "report" | null;
  statusCode: number | null;
};

function boundedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return redactSensitiveLogString(trimmed, CSP_REPORT_STRING_MAX).slice(0, CSP_REPORT_STRING_MAX);
}

function boundedDirective(value: unknown): string | null {
  const directive = boundedString(value);
  if (!directive) return null;
  return CSP_REPORT_DIRECTIVE_RE.test(directive) ? directive : null;
}

function boundedStatus(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 100 && value <= 599 ? value : null;
}

function boundedDisposition(value: unknown): "enforce" | "report" | null {
  return value === "enforce" || value === "report" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrapReport(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    if (value.length !== 1) return null;
    return unwrapReport(value[0]);
  }
  if (!isRecord(value)) return null;
  if (isRecord(value["csp-report"])) return value["csp-report"];
  if (value.type === "csp-violation" && isRecord(value.body)) return value.body;
  return value;
}

export function normalizeCspReportBody(value: unknown): NormalizedCspReport | null {
  const report = unwrapReport(value);
  if (!report) return null;
  const violatedDirective = boundedDirective(report["violated-directive"] ?? report.violatedDirective);
  const effectiveDirective = boundedDirective(report["effective-directive"] ?? report.effectiveDirective);
  const documentUri = boundedString(report["document-uri"] ?? report.documentURL ?? report.documentUri);
  const blockedUri = boundedString(report["blocked-uri"] ?? report.blockedURL ?? report.blockedUri);
  const disposition = boundedDisposition(report.disposition);
  const statusCode = boundedStatus(report["status-code"] ?? report.statusCode);
  if (!violatedDirective && !effectiveDirective) return null;
  return {
    documentUri,
    blockedUri,
    violatedDirective,
    effectiveDirective,
    disposition,
    statusCode,
  };
}

function stripSensitiveUrlQuery(value: string | null): string | null {
  if (!value) return value;
  return urlContainsSensitiveParams(value) ? stripSensitiveUrlParams(value) : value;
}

export function formatCspReportForSecurityLog(report: NormalizedCspReport): string {
  // Strip token/secret-like query params from URLs before emitting
  // the report into security logs. The URL itself must remain so the
  // CSP violation is debuggable; only the sensitive params are
  // dropped.
  const sanitized: NormalizedCspReport = {
    ...report,
    documentUri: stripSensitiveUrlQuery(report.documentUri),
    blockedUri: stripSensitiveUrlQuery(report.blockedUri),
  };
  return JSON.stringify(deepRedactEmailLikeInUnknown(sanitized));
}
