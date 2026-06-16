import { ShieldCheck } from "lucide-react";

export const UPLOAD_TRUST_NOTE =
  "Uploaded files are stored for this workspace. Oblixa reads document text to suggest dates, owners, and requirements, but those details are not used in reminders or reports until someone reviews them. Admins can export or delete workspace data.";

export interface UploadTrustNoteProps {
  /** When provided, renders a sentence-case scope label above the note so the
   *  trust statement reads as a labeled scope panel at the point of upload rather
   *  than a quiet footnote (§20). Omit for the compact inline treatment. */
  label?: string;
  /** Trust copy rendered in both variants. Defaults to the canonical upload note
   *  (`UPLOAD_TRUST_NOTE`). The CSV import context passes its own conservative
   *  "suggested / needs confirmation" copy here while reusing this component. */
  body?: string;
}

export function UploadTrustNote({ label, body = UPLOAD_TRUST_NOTE }: UploadTrustNoteProps = {}) {
  if (label) {
    return (
      <section
        aria-label={label}
        className="rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_16%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,var(--surface-raised))] px-3.5 py-3"
      >
        <p className="flex items-center gap-1.5">
          <ShieldCheck
            className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]"
            strokeWidth={1.85}
            aria-hidden
          />
          <span className="text-[12px] font-semibold leading-none text-[var(--text-primary)]">
            {label}
          </span>
        </p>
        <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
          {body}
        </p>
      </section>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_14%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_12%,var(--surface-raised))] px-3 py-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
      <ShieldCheck className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
      <span>{body}</span>
    </p>
  );
}
