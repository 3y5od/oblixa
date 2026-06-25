import { Info } from "lucide-react";

/**
 * Auth operational notice — the no-legal-advice boundary. Rendered in the footer
 * band (see AuthShell) opposite the legal-min links: left on mobile, right-aligned
 * on desktop.
 */
export function AuthLegalFooter() {
  return (
    <div className="sm:text-right">
      <p className="ui-caps-2 inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
        <Info size={10} strokeWidth={1.85} aria-hidden className="text-[var(--text-tertiary)]" />
        Operational notice
      </p>
      <p className="mt-1.5 max-w-sm text-[11px] leading-[1.55] text-[var(--text-tertiary)] sm:ml-auto">
        Oblixa does not provide legal advice. Review contract information against your originals.
      </p>
    </div>
  );
}
