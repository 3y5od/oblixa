import { Info } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";

/**
 * Authenticated-shell footer. A single quiet line that carries the binding
 * no-legal-advice boundary — not a disclosure toggle and not marketing
 * boilerplate. The full text lives behind the Terms link, which is the exact
 * "read more" action (so no vague "View"). It stays quieter than navigation.
 */
export function LegalFooter() {
  return (
    <footer id="legal-footer" className="ui-footer-shell shrink-0 px-4 py-2.5 md:px-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4">
        <p className="flex min-w-0 items-start gap-1.5 text-[11px] leading-snug text-[var(--text-secondary)] md:items-center">
          <Info
            size={11}
            strokeWidth={1.85}
            aria-hidden
            className="mt-px shrink-0 text-[var(--text-tertiary)] md:mt-0"
          />
          <span className="ui-text-wrap">
            Oblixa tracks contract follow-up after signature. It does not provide legal advice.
          </span>
        </p>
        <LegalLinks variant="compact" className="shrink-0 gap-x-4 gap-y-1" aria-label="Footer links" />
      </div>
    </footer>
  );
}
