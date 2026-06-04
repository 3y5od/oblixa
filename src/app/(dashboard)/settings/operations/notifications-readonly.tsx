import { Lock, Mail } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SETTINGS_NOTIFICATIONS_STRINGS,
  type NotificationCategoryKey,
} from "@/lib/settings/spec-strings";

// V4 §IA — read-only presentation for non-admins. The critique: never show
// editable-looking controls to users who cannot edit. Instead of disabled
// checkboxes (which still read as toggles), each reminder category renders
// as a status row with an On/Off badge. No inputs, no checkboxes, no Save —
// the quiet-hours window + reminder ratio live in the summary rail beside it.

const S = SETTINGS_NOTIFICATIONS_STRINGS;

export function NotificationsReadOnly({
  emailEnabled,
  selectedCategories,
}: {
  emailEnabled: boolean;
  selectedCategories: Set<NotificationCategoryKey>;
}) {
  return (
    <section
      id="notifications"
      className="ui-card-raised scroll-mt-6 overflow-hidden p-0"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
          >
            <Mail className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <h2
            id="notifications-content-title"
            className="min-w-0 text-[15.5px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.125rem]"
          >
            {S.sections.emailReminders}
          </h2>
        </div>
        <span
          role="img"
          aria-label={emailEnabled ? "Email channel: on" : "Email channel: off"}
          className="shrink-0"
        >
          <StatusBadge status={emailEnabled ? "healthy" : "disabled"}>
            <span aria-hidden>
              {emailEnabled ? S.badges.emailOn : S.badges.emailOff}
            </span>
          </StatusBadge>
        </span>
      </header>

      <div className="px-5 sm:px-6">
        {emailEnabled ? (
          <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
            {S.categories.map((category) => {
              const on = selectedCategories.has(
                category.key as NotificationCategoryKey
              );
              return (
                <li
                  key={category.key}
                  className="flex items-start justify-between gap-3 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-[var(--text-primary)]">
                      {category.label}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      {category.description}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5">
                    <StatusBadge status={on ? "healthy" : "disabled"}>
                      {on ? S.badges.emailOn : S.badges.emailOff}
                    </StatusBadge>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {S.channelOffBanner}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-2.5 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,transparent)] px-5 py-3.5 sm:px-6">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-tertiary)]"
        >
          <Lock className="h-3 w-3" strokeWidth={1.85} />
        </span>
        <span className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          {S.readOnlyFooter}
        </span>
      </footer>
    </section>
  );
}
