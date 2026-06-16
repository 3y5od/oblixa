import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LegalLinks } from "@/components/layout/legal-links";
import { AuthLegalFooter } from "./auth-legal-footer";
import { MAIN_CONTENT_ID } from "@/lib/qa/test-ids";

/** Home link — a quiet small ghost pill (border, no fill) on the left of the
 *  content grid. Deliberately lighter than a real action button. */
export function BackHomeLink() {
  return (
    <Link
      href="/"
      className="ui-btn-ghost ui-btn-sm inline-flex max-w-max items-center gap-1.5 rounded-full border border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)]"
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Back to home
    </Link>
  );
}

/** Brand lockup — matches the marketing header rhythm (de-glossed square tile +
 *  bold wordmark), one size down. The tile glyph is decorative; the link carries
 *  the accessible label. */
export function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Oblixa home"
      className="group inline-flex items-center gap-2.5 rounded-lg no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
    >
      <span className="ui-avatar-tile h-9 w-9 text-[15px] font-bold" aria-hidden>
        O
      </span>
      <span className="text-lg font-bold leading-none tracking-tight text-[var(--text-primary)] transition-opacity group-hover:opacity-85">
        Oblixa
      </span>
    </Link>
  );
}

export type AuthCardTone = "neutral" | "warning" | "success";

/**
 * The single focal surface: the auth form card (`.ui-auth-card`). An opt-in tone
 * rail (neutral=accent, warning, success) marks state cards. No `overflow-hidden`
 * — the tone rail is fully inset, and clipping would flatten the card shadow and
 * any focus ring that grazes the edge.
 */
export function AuthCard({ children, tone }: { children: ReactNode; tone?: AuthCardTone }) {
  // Tone rails mark only genuinely terminal warning/success states. Neutral
  // (informational recovery) and normal login carry no rail — the state card's
  // medallion already conveys the neutral tone.
  const railColor =
    tone === "warning" ? "var(--warning-ink)" : tone === "success" ? "var(--success-ink)" : undefined;
  return (
    <div
      className={`ui-auth-card relative rounded-2xl p-5 sm:p-6 ${railColor ? "ui-auth-card--rail" : ""}`.trim()}
      style={railColor ? ({ "--ui-auth-rail": railColor } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Auth page shell — a deliberate viewport: one centered content grid carries the
 * top chrome row, the two-column (or single) body, and the footer row, so all
 * three align to the same column edges. `min-h-full` + `flex-1` lets the footer
 * settle at the bottom on tall screens (via `mt-auto`) instead of floating
 * mid-page. Luminous backdrop, no dotted grid, a single faint top hairline.
 */
export function AuthShell({
  productPanel,
  children,
}: {
  /** Left product column (login/signup only). When omitted the form is centered. */
  productPanel?: ReactNode;
  /** The auth column (header + card + callout). */
  children: ReactNode;
}) {
  const wide = Boolean(productPanel);
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="landing-luminous landing-luminous--auth relative isolate flex min-h-full flex-1 flex-col overflow-hidden px-4 pb-10 pt-6 outline-none sm:px-6 sm:pt-10"
    >
      <div aria-hidden className="landing-luminous__base" />
      <div aria-hidden className="landing-luminous__glow" />
      {/* Faint full-width top hairline (marketing entry-page parity). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--accent)_20%,transparent)_50%,transparent_100%)]"
      />
      <div className={`relative mx-auto flex w-full flex-1 flex-col ${wide ? "max-w-[74rem]" : "max-w-[29rem]"}`}>
        <div className="mb-9 flex items-center justify-between gap-4">
          <BackHomeLink />
          <BrandMark />
        </div>

        {wide ? (
          // Mobile reads form-first, then the product artifact below it; on
          // desktop the artifact returns to the left column via lg:order.
          <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_29rem] lg:items-start">
            <div className="order-2 min-w-0 lg:order-1">{productPanel}</div>
            <div className="order-1 lg:order-2">{children}</div>
          </div>
        ) : (
          children
        )}

        {/* Footer row — settles at the bottom on tall screens, hugs content on
            short ones; aligned to the same content grid as the body. */}
        <div className="mt-auto pt-10">
          <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)] pt-5 sm:flex sm:items-start sm:justify-between sm:gap-8">
            <LegalLinks className="flex-wrap gap-x-4 gap-y-1.5" />
            <div className="mt-4 max-w-sm sm:mt-0 sm:shrink-0 sm:text-right">
              <AuthLegalFooter />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
