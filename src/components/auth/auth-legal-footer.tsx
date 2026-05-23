import { Info } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";

export function AuthLegalFooter() {
  return (
    <footer className="ui-footer-shell px-4 py-5 text-center">
      <LegalLinks className="justify-center gap-x-5" />
      <p className="ui-caps-2 mx-auto mt-3 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary)]">
        <Info
          size={11}
          strokeWidth={1.85}
          aria-hidden
          className="text-[var(--accent-strong)]"
        />
        Operational notice
      </p>
      <p className="mx-auto mt-1.5 max-w-lg text-[11.5px] leading-[1.55] text-[var(--text-tertiary)]">
        Oblixa does not provide legal advice. Verify critical terms against your originals.
      </p>
    </footer>
  );
}
