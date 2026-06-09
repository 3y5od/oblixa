import { ShieldCheck } from "lucide-react";

export const UPLOAD_TRUST_NOTE =
  "Uploaded files are stored for this workspace. Oblixa reads document text to suggest dates, owners, and requirements, but those details are not used in reminders or reports until someone reviews them. Admins can export or delete workspace data.";

export function UploadTrustNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_14%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))] px-3 py-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
      <ShieldCheck className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
      <span>{UPLOAD_TRUST_NOTE}</span>
    </p>
  );
}
