import { Resend } from "resend";
import type { WorkspaceProductMode } from "@/lib/product-surface/types";
import {
  degradeOutboundEmailCopyForCore,
  emailCopyUsesCoreSurface,
} from "@/lib/email-workspace-degrade";

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not configured");
    return null;
  }
  resend = new Resend(apiKey);
  return resend;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReminderEmailParams {
  to: string;
  contractTitle: string;
  fieldName: string;
  fieldValue: string;
  daysUntil: number;
  contractUrl: string;
  /** Approved field citation shown for trust */
  sourceSnippet?: string | null;
}

export async function sendReminderEmail({
  to,
  contractTitle,
  fieldName,
  fieldValue,
  daysUntil,
  contractUrl,
  sourceSnippet,
}: ReminderEmailParams) {
  const resendClient = getResendClient();
  if (!resendClient) {
    return { error: new Error("Email provider is not configured") };
  }
  const label = fieldName.replace(/_/g, " ");
  const urgency =
    daysUntil <= 1 ? "URGENT" : daysUntil <= 7 ? "Upcoming" : "Reminder";

  const safeLabel = escapeHtml(label);
  const safeTitle = escapeHtml(contractTitle);
  const safeValue = escapeHtml(fieldValue);
  const safeUrl = escapeHtml(contractUrl);
  const safeSnippet =
    sourceSnippet && sourceSnippet.trim()
      ? escapeHtml(sourceSnippet.trim())
      : null;

  const { error } = await resendClient.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject: `${urgency}: ${label} for "${contractTitle}" in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #111827; font-size: 18px;">Contract deadline approaching</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
          The <strong>${safeLabel}</strong> for <strong>${safeTitle}</strong> is
          <strong>${daysUntil === 0 ? "today" : `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}</strong>
          (${safeValue}).
        </p>
        ${
          safeSnippet
            ? `<div style="margin-top: 16px; padding: 12px 14px; background-color: #f9fafb;
                 border-left: 3px solid #2563eb; border-radius: 4px;">
                 <p style="margin: 0 0 6px; color: #6b7280; font-size: 11px; text-transform: uppercase;
                    letter-spacing: 0.04em; font-weight: 600;">Source (approved)</p>
                 <p style="margin: 0; color: #374151; font-size: 13px; line-height: 1.5; font-style: italic;">
                   &ldquo;${safeSnippet}&rdquo;
                 </p>
               </div>`
            : ""
        }
        <a href="${safeUrl}"
           style="display: inline-block; margin-top: 16px; padding: 10px 20px;
                  background-color: #2563eb; color: #ffffff; text-decoration: none;
                  border-radius: 6px; font-size: 14px; font-weight: 500;">
          View contract
        </a>
        <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">
          You received this because you are the owner of this contract on Oblixa.
        </p>
      </div>
    `,
  });

  return { error };
}

export async function sendReviewBoardPacketEmail({
  to,
  subject,
  htmlBody,
}: {
  to: string;
  subject: string;
  htmlBody: string;
}) {
  const resendClient = getResendClient();
  if (!resendClient) {
    return { error: new Error("Email provider is not configured") };
  }
  const { error } = await resendClient.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject,
    html: htmlBody,
  });
  return { error };
}

interface SavedViewSummaryEmailParams {
  to: string | string[];
  viewName: string;
  appUrl: string;
  itemCount: number;
  workspacePath: string;
  sampleRows: Array<{ label: string; href: string; meta: string }>;
  openPixelUrl?: string | null;
  /** When Core (default), strip contained-module names from copy (refinement §18). */
  workspaceProductMode?: WorkspaceProductMode;
}

export async function sendSavedViewSummaryEmail({
  to,
  viewName,
  appUrl,
  itemCount,
  workspacePath,
  sampleRows,
  openPixelUrl,
  workspaceProductMode,
}: SavedViewSummaryEmailParams) {
  const resendClient = getResendClient();
  if (!resendClient) {
    return { error: new Error("Email provider is not configured") };
  }
  const coreCopy = emailCopyUsesCoreSurface(workspaceProductMode);
  const viewNameForEmail = coreCopy ? degradeOutboundEmailCopyForCore(viewName) : viewName;
  const rowsForEmail = coreCopy
    ? sampleRows.map((r) => ({
        ...r,
        label: degradeOutboundEmailCopyForCore(r.label),
        meta: degradeOutboundEmailCopyForCore(r.meta),
      }))
    : sampleRows;
  const safeViewName = escapeHtml(viewNameForEmail);
  const safeAppUrl = escapeHtml(appUrl.replace(/\/+$/, ""));
  const safeOpenPixelUrl = openPixelUrl ? escapeHtml(openPixelUrl) : null;

  const rowsHtml =
    rowsForEmail.length === 0
      ? `<p style="color:#6b7280;font-size:13px;margin:0;">No contracts currently match this view.</p>`
      : `<ul style="padding-left:18px;margin:0;">
          ${rowsForEmail
            .map((row) => {
              const safeTitle = escapeHtml(row.label);
              const safeMeta = escapeHtml(row.meta);
              const safeHref = `${safeAppUrl}${row.href}`;
              return `<li style="margin:0 0 8px;">
                        <a href="${safeHref}" style="color:#1f2937;text-decoration:none;font-weight:600;">${safeTitle}</a>
                        <span style="color:#6b7280;font-size:12px;"> · ${safeMeta}</span>
                      </li>`;
            })
            .join("")}
        </ul>`;

  const { error } = await resendClient.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject: `Weekly summary: ${viewNameForEmail} (${itemCount})`,
    html: `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;">
        <h2 style="color:#111827;font-size:18px;margin-bottom:8px;">Oblixa weekly summary</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 14px;">
          Saved view: <strong>${safeViewName}</strong>
        </p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Matching records: <strong>${itemCount}</strong>
        </p>
        <div style="padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
          ${rowsHtml}
        </div>
        <a href="${safeAppUrl}${workspacePath}"
           style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
          Open workspace
        </a>
        <p style="margin-top:24px;color:#9ca3af;font-size:12px;">
          You received this because weekly digest is enabled on one of your saved views.
        </p>
        ${
          safeOpenPixelUrl
            ? `<img src="${safeOpenPixelUrl}" alt="" width="1" height="1" style="display:block;opacity:0;" />`
            : ""
        }
      </div>
    `,
  });

  return { error };
}

interface ReportPackDigestEmailParams {
  to: string | string[];
  packName: string;
  reportType: string;
  appUrl: string;
  metricsSummary: Array<{ label: string; value: string }>;
  reportsPath?: string;
  workspaceProductMode?: WorkspaceProductMode;
}

export async function sendReportPackDigestEmail({
  to,
  packName,
  reportType,
  appUrl,
  metricsSummary,
  reportsPath = "/contracts/reports",
  workspaceProductMode,
}: ReportPackDigestEmailParams) {
  const resendClient = getResendClient();
  if (!resendClient) {
    return { error: new Error("Email provider is not configured") };
  }
  const coreCopy = emailCopyUsesCoreSurface(workspaceProductMode);
  const packNameForEmail = coreCopy ? degradeOutboundEmailCopyForCore(packName) : packName;
  const reportTypeForEmail = coreCopy ? degradeOutboundEmailCopyForCore(reportType) : reportType;
  const metricsForEmail = coreCopy
    ? metricsSummary.map((m) => ({
        label: degradeOutboundEmailCopyForCore(m.label),
        value: degradeOutboundEmailCopyForCore(m.value),
      }))
    : metricsSummary;
  const safeName = escapeHtml(packNameForEmail);
  const safeType = escapeHtml(reportTypeForEmail);
  const base = appUrl.replace(/\/+$/, "");
  const safeBase = escapeHtml(base);
  const rows =
    metricsForEmail.length === 0
      ? "<p style=\"color:#6b7280;font-size:13px;\">No KPI rows.</p>"
      : `<table style="border-collapse:collapse;width:100%;max-width:480px;font-size:13px;">
          ${metricsForEmail
            .map(
              (r) =>
                `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#52525b;">${escapeHtml(
                  r.label
                )}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#18181b;">${escapeHtml(
                  r.value
                )}</td></tr>`
            )
            .join("")}
        </table>`;

  const { error } = await resendClient.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject: `Report pack: ${packNameForEmail}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#111827;font-size:18px;">${safeName}</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Type: ${safeType}</p>
        ${rows}
        <p style="margin-top:20px;">
          <a href="${safeBase}${escapeHtml(reportsPath)}"
             style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">
            Open reports workspace
          </a>
        </p>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px;">
          You are subscribed to this report pack in Oblixa.
        </p>
      </div>
    `,
  });
  return { error };
}
