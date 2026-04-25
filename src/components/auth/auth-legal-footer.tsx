import { LegalLinks } from "@/components/layout/legal-links";

export function AuthLegalFooter() {
  return (
    <footer className="ui-footer-shell px-4 py-6 text-center">
      <LegalLinks className="justify-center" />
      <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-[var(--text-secondary)]">
        Oblixa does not provide legal advice. Verify critical terms against your originals.
      </p>
    </footer>
  );
}
