import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { error } = await resend.emails.send({
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
          You received this because you are the owner of this contract on ContractOps.
        </p>
      </div>
    `,
  });

  return { error };
}
