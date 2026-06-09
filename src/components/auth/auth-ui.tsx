import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Approved caps-token separator (§2.9 Tactic C) — never a bare middle dot. */
export function DotSep() {
  return (
    <span className="ui-dot-sep" aria-hidden>
      ·
    </span>
  );
}

type QuietChipTone = "neutral" | "accent" | "success";

function quietChipStyle(tone: QuietChipTone): CSSProperties {
  if (tone === "accent") {
    return {
      color: "var(--accent-strong)",
      borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border-card))",
      background: "color-mix(in oklab, var(--accent-soft) 18%, var(--surface-raised))",
    };
  }
  if (tone === "success") {
    return {
      color: "var(--success-ink)",
      borderColor: "color-mix(in oklab, var(--success) 24%, var(--border-card))",
      background: "color-mix(in oklab, var(--success-soft) 24%, var(--surface-raised))",
    };
  }
  return {
    color: "var(--text-tertiary)",
    borderColor: "var(--border-card)",
    background: "color-mix(in oklab, var(--surface-raised) 60%, transparent)",
  };
}

/**
 * Quiet caps fact chip — a single bordered caps token (no key/value, no count).
 * Replaces dot-separated caps strips on the auth proof surfaces (preview
 * metadata, workspace callout) with discrete structured chips (§2.6). Caps
 * weight/tracking comes from the shared `.ui-caps-3` tier, not bespoke values.
 */
export function QuietFactChip({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: ReactNode;
  tone?: QuietChipTone;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "md" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]";
  return (
    <span
      className={`ui-caps-3 inline-flex items-center rounded-md border leading-none ${sizeCls}`}
      style={quietChipStyle(tone)}
    >
      {children}
    </span>
  );
}

/**
 * Page-identity medallion (§2.4): rounded-xl, accent-tinted surface + border,
 * accent-strong glyph. `md` (40px) anchors the focal form-column header; `sm`
 * (36px) is the quieter weight for the supporting product panel so the two
 * identities don't read at identical weight.
 */
export function AuthIconTile({ icon: Icon, size = "md" }: { icon: LucideIcon; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const glyph = size === "sm" ? "h-4 w-4" : "h-[1.125rem] w-[1.125rem]";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]`}
      aria-hidden
    >
      <Icon className={glyph} strokeWidth={1.85} />
    </span>
  );
}
