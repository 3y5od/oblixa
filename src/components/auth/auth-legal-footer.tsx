import Link from "next/link";

export function AuthLegalFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-surface/80 px-4 py-6 text-center">
      <nav
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-zinc-500"
        aria-label="Legal and policies"
      >
        <Link href="/security" prefetch={false} className="ui-link text-zinc-600 hover:text-zinc-800">
          Security
        </Link>
        <Link href="/privacy" prefetch={false} className="ui-link text-zinc-600 hover:text-zinc-800">
          Privacy
        </Link>
        <Link href="/terms" prefetch={false} className="ui-link text-zinc-600 hover:text-zinc-800">
          Terms
        </Link>
        <Link href="/accessibility" prefetch={false} className="ui-link text-zinc-600 hover:text-zinc-800">
          Accessibility
        </Link>
        <Link href="/cookies" prefetch={false} className="ui-link text-zinc-600 hover:text-zinc-800">
          Cookies
        </Link>
      </nav>
      <p className="mx-auto mt-3 max-w-lg text-[10px] leading-relaxed text-zinc-500">
        Oblixa does not provide legal advice. Verify critical terms against your originals.
      </p>
    </footer>
  );
}
