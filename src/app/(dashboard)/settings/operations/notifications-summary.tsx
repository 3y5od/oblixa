import type { ReactNode } from "react";
import { Moon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RatioChip } from "@/components/ui/ratio-chip";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";

// V4 §5 — quiet companion rail to the notifications form. Reflects the
// derived posture of the *current* (pending) form state so the page
// reads as two columns and the interpreted quiet window (any-time /
// overnight) is legible without parsing the raw number inputs. Pure
// presentational: all state lives in the parent view.

const S = SETTINGS_NOTIFICATIONS_STRINGS;

function pad2(hour: number): string {
  const clamped = Math.min(23, Math.max(0, Math.trunc(hour)));
  return `${String(clamped).padStart(2, "0")}:00`;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] py-2.5 last:border-b-0">
      <dt className="ui-caps-2 shrink-0 text-[10.5px] leading-none text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {children}
      </dd>
    </div>
  );
}

function OnOffBadge({ on }: { on: boolean }) {
  return (
    <StatusBadge status={on ? "healthy" : "disabled"}>
      {on ? S.badges.emailOn : S.badges.emailOff}
    </StatusBadge>
  );
}

export function NotificationsSummary({
  emailEnabled,
  quietStart,
  quietEnd,
  enabledReminderCount,
  totalReminderCount,
  digestEnabled,
}: {
  emailEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  enabledReminderCount: number;
  totalReminderCount: number;
  digestEnabled: boolean;
}) {
  const anyTime = quietStart === quietEnd;
  const overnight = quietStart > quietEnd;
  const allReminders = enabledReminderCount === totalReminderCount;

  return (
    <aside
      aria-label={S.summary.title}
      className="ui-card p-5 lg:sticky lg:top-6"
    >
      <div className="min-w-0">
        <p className="ui-caps-2 text-[10.5px] leading-none text-[var(--accent-strong)]">
          {S.summary.eyebrow}
        </p>
        <h2 className="mt-1.5 text-[1.05rem] font-semibold tracking-tight text-[var(--text-primary)]">
          {S.summary.title}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {S.summary.context}
        </p>
      </div>

      <dl className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)]">
        <SummaryRow label={S.summary.emailLabel}>
          <OnOffBadge on={emailEnabled} />
        </SummaryRow>

        {emailEnabled ? (
          <>
            <SummaryRow label={S.summary.quietLabel}>
              {anyTime ? (
                <span className="inline-flex items-center rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
                  {S.summary.anyTime}
                </span>
              ) : (
                <>
                  {overnight ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--accent-strong)]">
                      <Moon className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                      {S.summary.overnight}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-medium tabular-nums leading-none text-[var(--text-secondary)]">
                    <span>{pad2(quietStart)}</span>
                    <span aria-hidden className="text-[var(--text-tertiary)]">
                      –
                    </span>
                    <span>{pad2(quietEnd)}</span>
                    <span className="ml-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                      {S.utcLabel}
                    </span>
                  </span>
                </>
              )}
            </SummaryRow>

            <SummaryRow label={S.summary.remindersLabel}>
              <RatioChip
                numerator={enabledReminderCount}
                denominator={totalReminderCount}
                tone={allReminders ? "success" : undefined}
              />
            </SummaryRow>

            <SummaryRow label={S.summary.digestLabel}>
              <OnOffBadge on={digestEnabled} />
            </SummaryRow>
          </>
        ) : null}
      </dl>

      {!emailEnabled ? (
        <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          {S.summary.pausedNote}
        </p>
      ) : null}
    </aside>
  );
}
