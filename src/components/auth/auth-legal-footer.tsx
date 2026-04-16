import Link from "next/link";

export function AuthLegalFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_82%,transparent)] px-4 py-6 text-center backdrop-blur-md">
      <nav
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-[var(--text-tertiary)]"
        aria-label="Legal and policies"
      >
        <Link href="/security" prefetch={false} className="ui-link">
          Security
        </Link>
        <Link href="/privacy" prefetch={false} className="ui-link">
          Privacy
        </Link>
        <Link href="/terms" prefetch={false} className="ui-link">
          Terms
        </Link>
        <Link href="/accessibility" prefetch={false} className="ui-link">
          Accessibility
        </Link>
        <Link href="/cookies" prefetch={false} className="ui-link">
          Cookies
        </Link>
      </nav>
      <p className="mx-auto mt-3 max-w-lg text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        Oblixa does not provide legal advice. Verify critical terms against your originals.
      </p>
    </footer>
  );
}
