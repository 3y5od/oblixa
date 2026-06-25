import Link from "next/link";
import { ArrowRight, KeyRound, RotateCcw, type LucideIcon } from "lucide-react";

interface AccessPath {
  icon: LucideIcon;
  label: string;
  detail: string;
  href: string;
  linkText: string;
}

/** Operational access paths for people who can't sign in — no pricing, no
 *  product proof, just how to get in. */
const ACCESS_PATHS: ReadonlyArray<AccessPath> = [
  {
    icon: KeyRound,
    label: "No account yet?",
    detail: "Workspace access is by invitation or approved request.",
    href: "/request-access",
    linkText: "Request access",
  },
  {
    icon: RotateCcw,
    label: "Forgot your password?",
    detail: "Reset it with the link sent to your email.",
    href: "/forgot-password",
    linkText: "Reset password",
  },
];

/**
 * Quiet operational access panel — the secondary column beside the sign-in form
 * on desktop. It carries access/auth paths only (how to get in, recovery);
 * deliberately lighter than the form sheet so the form stays the primary object.
 * No product imagery, fake records, or pricing.
 */
export function AuthAccessPanel() {
  return (
    <aside
      data-testid="auth-access-panel"
      aria-label="Access help"
      className="rounded-[10px] border border-[color:color-mix(in_oklab,var(--border-subtle)_92%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_42%,transparent)] p-6 sm:p-7"
    >
      <div className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {ACCESS_PATHS.map(({ icon: Icon, label, detail, href, linkText }) => (
          <div key={href} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
            <span
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-raised)_60%,transparent)] text-[var(--text-tertiary)]"
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{label}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">{detail}</p>
              <Link
                href={href}
                className="group mt-1.5 inline-flex items-center gap-1 rounded-sm text-[12px] font-semibold text-[var(--accent-strong)] no-underline transition-colors hover:underline hover:decoration-from-font hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {linkText}
                <ArrowRight
                  className="h-3 w-3 transition-transform motion-safe:group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
