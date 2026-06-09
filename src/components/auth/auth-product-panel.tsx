import { PRODUCT_COPY, PRODUCT_FACTS } from "./auth-config";
import { AuthProductPreview } from "./auth-product-preview";
import { AuthIconTile, QuietFactChip } from "./auth-ui";

/** Product-fact cells with reserved icon slots — reused in the desktop
 *  equal-cell strip and the mobile grid (classes passed per usage). */
export function AuthProductFacts({ className }: { className: string }) {
  return (
    <ul className={className}>
      {PRODUCT_FACTS.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
          <span className="leading-none">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Secondary product column (desktop only) — quieter `sm` icon-tile identity with
 * a login-contextual heading, a source-backed framing pair, an equal-cell
 * hairline-bounded fact strip, and a content-led workspace-slice preview.
 */
export function AuthProductPanel() {
  const { icon, eyebrow, heading, support } = PRODUCT_COPY;
  return (
    <section className="hidden min-w-0 lg:block" aria-label="What Oblixa does">
      <div className="flex items-start gap-3.5">
        <AuthIconTile icon={icon} size="sm" />
        <div className="min-w-0">
          <p>
            <span className="landing-eyebrow-dot ui-caps-1 text-[10.5px] text-[var(--accent-strong)]">{eyebrow}</span>
          </p>
          <h2 className="mt-1 text-balance text-[1.4rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
            {heading}
          </h2>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">{support}</p>
          {/* AI framed correctly — source-backed suggestions you review, not an
              authority. Never a headline (§ AI boundary). */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <QuietFactChip tone="accent">Source-backed</QuietFactChip>
            <QuietFactChip>Reviewed by you</QuietFactChip>
          </div>
        </div>
      </div>

      <AuthProductFacts className="mt-5 grid grid-cols-4 gap-x-2 border-y border-[color:color-mix(in_oklab,var(--border-subtle)_50%,transparent)] py-2.5" />

      <div className="mt-5">
        <AuthProductPreview />
      </div>
    </section>
  );
}
