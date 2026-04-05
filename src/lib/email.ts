import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReminderEmailParams {
  to: string;
  contractTitle: string;
  fieldName: string;
  fieldValue: string;
  daysUntil: number;
  contractUrl: string;
}

export async function sendReminderEmail({
  to,
  contractTitle,
  fieldName,
  fieldValue,
  daysUntil,
  contractUrl,
}: ReminderEmailParams) {
  const label = fieldName.replace(/_/g, " ");
  const urgency =
    daysUntil <= 1 ? "URGENT" : daysUntil <= 7 ? "Upcoming" : "Reminder";

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject: `${urgency}: ${label} for "${contractTitle}" in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #111827; font-size: 18px;">Contract deadline approaching</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
          The <strong>${label}</strong> for <strong>${contractTitle}</strong> is
          <strong>${daysUntil === 0 ? "today" : `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}</strong>
          (${fieldValue}).
        </p>
        <a href="${contractUrl}"
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
