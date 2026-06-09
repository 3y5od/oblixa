import type { ReactNode } from "react";
import { CardMedallion, type CardMedallionTone } from "@/components/ui/card-medallion";

export interface SettingsCardHeaderProps {
  icon: ReactNode;
  /** Caps category label (e.g. "MFA", "ACCESS", "POLICY"). Optional when a
   *  card has no non-doubling category noun (e.g. the lone notifications card). */
  eyebrow?: string;
  /** Descriptive card title at 1.05rem. */
  title: ReactNode;
  /** Optional id on the <h2> so skip links / aria can target it. */
  titleId?: string;
  /** Right-aligned status badge or chip (e.g. REQUIRES PASSWORD). */
  badge?: ReactNode;
  tone?: CardMedallionTone;
}

/**
 * Normalized settings card header: 32px tone medallion, caps eyebrow with the
 * accent dot, a 1.05rem title, and an optional right-aligned badge — shared so
 * every settings card head reads the same across security, billing, and
 * notifications.
 */
export function SettingsCardHeader({
  icon,
  eyebrow,
  title,
  titleId,
  badge,
  tone = "accent",
}: SettingsCardHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <CardMedallion tone={tone}>{icon}</CardMedallion>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="leading-none">
              <span className="ui-caps-2 text-[var(--accent-strong)]">{eyebrow}</span>
            </p>
          ) : null}
          <h2
            id={titleId}
            className={`${eyebrow ? "mt-1 " : ""}text-[1.05rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)]`}
          >
            {title}
          </h2>
        </div>
      </div>
      {badge ? <div className="shrink-0 self-start">{badge}</div> : null}
    </header>
  );
}
