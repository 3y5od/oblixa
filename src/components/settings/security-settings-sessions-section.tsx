import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, fmtRelative, timeAttrs } from "@/lib/format/date";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import type { SessionRow } from "./security-settings-panel-types";

type SecuritySettingsSessionsSectionProps = {
  sessions: SessionRow[];
  pending: boolean;
  onSignOutOthers: () => void;
};

export function SecuritySettingsSessionsSection({
  sessions,
  pending,
  onSignOutOthers,
}: SecuritySettingsSessionsSectionProps) {
  // Only offer "sign out all other devices" when the provider actually reports
  // other sessions; otherwise it is a placeholder control that can target
  // nothing (release-state /settings/security: session controls only when
  // provider-backed; show status, not dead controls).
  const otherSessionCount = sessions.filter((s) => !s.current).length;
  return (
    <section aria-labelledby="sessions-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pb-2">
        <h2 id="sessions-title" className="inline-flex items-baseline gap-2 text-[15px] font-semibold text-[var(--text-primary)]">
          <span>{SETTINGS_SECURITY_STRINGS.sections.sessions}</span>
          {sessions.length > 1 ? (
            <span className="ui-caps-3 font-normal tabular-nums text-[var(--text-tertiary)]">
              {sessions.length} signed-in devices
            </span>
          ) : null}
        </h2>
      </div>
      {sessions.length > 0 ? (
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
          {sessions.map((s) => (
            <li
              key={s.id}
              aria-current={s.current ? "true" : undefined}
              className="group flex flex-wrap items-center gap-2 py-2.5"
            >
              <StatusBadge status={s.current ? "healthy" : "disabled"}>
                {s.current ? SETTINGS_SECURITY_STRINGS.sessionsCurrentLabel : "DEVICE"}
              </StatusBadge>
              {s.expiresAt ? (
                <time className="text-[11.5px] tabular-nums text-[var(--text-tertiary)]" {...timeAttrs(s.expiresAt)}>
                  Expires {fmtRelative(s.expiresAt)}
                  <span className="sr-only"> ({formatDate(s.expiresAt, "dateTime")})</span>
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-[12px] leading-snug text-[var(--text-secondary)]">
        {otherSessionCount > 0
          ? SETTINGS_SECURITY_STRINGS.sessionsConsequence
          : SETTINGS_SECURITY_STRINGS.sessionsOnlyCurrentNote}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {otherSessionCount > 0 ? (
          <button
            type="button"
            className="ui-btn-secondary rounded-full border-[color:color-mix(in_oklab,var(--danger-ink)_28%,var(--border-subtle))] text-[var(--danger-ink)] billing-no-print"
            disabled={pending}
            onClick={onSignOutOthers}
          >
            {SETTINGS_SECURITY_STRINGS.signOutOthersCta}
          </button>
        ) : null}
        <Link href="/auth/sign-out" className="ui-btn-ghost rounded-full billing-no-print">
          {SETTINGS_SECURITY_STRINGS.signOutSelfCta}
        </Link>
      </div>
    </section>
  );
}
