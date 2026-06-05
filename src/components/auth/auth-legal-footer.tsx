import { Info } from "lucide-react";

/**
 * Auth operational notice — the no-legal-advice boundary. Rendered inside the
 * auth content block (under the legal links row), not as a viewport-pinned page
 * footer, so it hugs the columns and the luminous backdrop fills the calm space
 * below. The legal links themselves render in a sibling row (see AuthForm).
 */
export function AuthLegalFooter() {
  return (
    <div className="text-center">
      <p className="ui-caps-2 mx-auto inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
        <Info size={11} strokeWidth={1.85} aria-hidden className="text-[var(--accent-strong)]" />
        Operational notice
      </p>
      <p className="mx-auto mt-1.5 max-w-lg text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">
        Oblixa does not provide legal advice. Verify critical terms against your originals.
      </p>
    </div>
  );
}
