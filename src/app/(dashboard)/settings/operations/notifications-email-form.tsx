import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { SettingsCardHeader } from "@/components/settings/settings-card";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiToggle } from "@/components/ui/ui-toggle";
import {
  SETTINGS_NOTIFICATIONS_STRINGS,
  type NotificationCategoryKey,
} from "@/lib/settings/spec-strings";
import { hourValue, pad2 } from "./notifications-policy";

type NotificationCategory = (typeof SETTINGS_NOTIFICATIONS_STRINGS.categories)[number];

type NotificationsEmailFormProps = {
  formRef: RefObject<HTMLFormElement | null>; idempotencyKey: string;
  emailEnabled: boolean; formDisabled: boolean;
  emailRemindersId: string; quietStartId: string; quietEndId: string; quietCaptionId: string;
  reminderDefaultsTitleId: string; quietStart: number; quietEnd: number;
  anyTime: boolean; overnight: boolean;
  selectedCategories: Set<NotificationCategoryKey>;
  reminderCategories: NotificationCategory[]; digestCategory: NotificationCategory | undefined;
  digestEnabled: boolean; showCountChip: boolean;
  enabledReminderCount: number; totalReminderCount: number;
  pending: boolean; error: string | null; message: string | null;
  isDirty: boolean; canEdit: boolean;
  segBase: string; segActive: string; segIdle: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onEmailToggle: (checked: boolean) => void; onSelectAnyTime: () => void; onSelectWindow: () => void;
  onToggleCategory: (key: NotificationCategoryKey) => void; onDiscard: () => void;
  setQuietStart: Dispatch<SetStateAction<number>>; setQuietEnd: Dispatch<SetStateAction<number>>;
};

function CategoryRow({
  category,
  checked,
  onToggle,
}: {
  category: { key: string; label: string; description: string };
  checked: boolean;
  onToggle: () => void;
}) {
  const checkboxId = `notif-${category.key}`;
  return (
    <label
      htmlFor={checkboxId}
      className="-mx-2 flex min-h-[44px] cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,transparent)]"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
          {category.label}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--text-secondary)]">
          {category.description}
        </span>
      </span>
      <input
        id={checkboxId}
        type="checkbox"
        className="ui-checkbox mt-0.5 shrink-0"
        name="notificationCategories"
        value={category.key}
        checked={checked}
        onChange={onToggle}
      />
    </label>
  );
}

export function NotificationsEmailForm({
  formRef,
  idempotencyKey,
  emailEnabled,
  formDisabled,
  emailRemindersId,
  quietStartId,
  quietEndId,
  quietCaptionId,
  reminderDefaultsTitleId,
  quietStart,
  quietEnd,
  anyTime,
  overnight,
  selectedCategories,
  reminderCategories,
  digestCategory,
  digestEnabled,
  showCountChip,
  enabledReminderCount,
  totalReminderCount,
  pending,
  error,
  message,
  isDirty,
  canEdit,
  segBase,
  segActive,
  segIdle,
  onSubmit,
  onEmailToggle,
  onSelectAnyTime,
  onSelectWindow,
  onToggleCategory,
  onDiscard,
  setQuietStart,
  setQuietEnd,
}: NotificationsEmailFormProps) {
  return (
    <>
      <SettingsCardHeader
        icon={<Mail className="h-4 w-4" strokeWidth={1.85} />}
        title={SETTINGS_NOTIFICATIONS_STRINGS.sections.emailReminders}
        titleId={reminderDefaultsTitleId}
        badge={
          <span role="img" aria-label={emailEnabled ? "Email channel: on" : "Email channel: off"}>
            <StatusBadge status={emailEnabled ? "healthy" : "disabled"}>
              <span aria-hidden>
                {emailEnabled
                  ? SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOn
                  : SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOff}
              </span>
            </StatusBadge>
          </span>
        }
      />

      <form ref={formRef} onSubmit={onSubmit} noValidate className="billing-no-print">
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <UiToggle
            name="emailEnabled"
            label={SETTINGS_NOTIFICATIONS_STRINGS.emailRemindersToggleLabel}
            checked={emailEnabled}
            disabled={formDisabled}
            ariaDescribedBy={emailRemindersId}
            onChange={onEmailToggle}
          />

          {!emailEnabled ? (
            <p
              id={emailRemindersId}
              role="note"
              className="rounded-md border border-[color:color-mix(in_oklab,var(--warning-soft)_55%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--warning-soft)_22%,var(--surface-raised))] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--warning-ink)]"
            >
              {SETTINGS_NOTIFICATIONS_STRINGS.channelOffBanner}
            </p>
          ) : null}

          <fieldset
            disabled={!emailEnabled || formDisabled}
            className="min-w-0 space-y-6 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-5"
          >
            <legend className="sr-only">Reminder settings</legend>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p id={`${quietStartId}-legend`} className="text-[13px] font-medium text-[var(--text-secondary)]">
                  {SETTINGS_NOTIFICATIONS_STRINGS.quietHoursLegend}
                </p>
                <span className="ui-caps-3 inline-flex items-center rounded-full border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9.5px] leading-none text-[var(--text-tertiary)]">
                  {SETTINGS_NOTIFICATIONS_STRINGS.utcLabel}
                </span>
                {overnight ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--accent-strong)]">
                    {SETTINGS_NOTIFICATIONS_STRINGS.summary.overnight}
                  </span>
                ) : null}
              </div>

              <div
                role="group"
                aria-label="Quiet hours mode"
                className="mt-2.5 inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-0.5"
              >
                <button type="button" onClick={onSelectAnyTime} aria-pressed={anyTime} className={`${segBase} ${anyTime ? segActive : segIdle}`}>
                  {SETTINGS_NOTIFICATIONS_STRINGS.summary.anyTime}
                </button>
                <button type="button" onClick={onSelectWindow} aria-pressed={!anyTime} className={`${segBase} ${!anyTime ? segActive : segIdle}`}>
                  Quiet window
                </button>
              </div>

              {anyTime ? (
                <>
                  <p id={quietCaptionId} className="mt-2 text-[12px] leading-snug text-[var(--text-tertiary)]">
                    {SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption}
                  </p>
                  <input type="hidden" name="emailQuietStartUtc" value={quietStart} />
                  <input type="hidden" name="emailQuietEndUtc" value={quietEnd} />
                </>
              ) : (
                <div className="mt-2.5 flex items-end gap-3" role="group" aria-labelledby={`${quietStartId}-legend`}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={quietStartId} className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                      {SETTINGS_NOTIFICATIONS_STRINGS.quietStartLabel}
                    </label>
                    <div className="inline-flex items-center gap-1">
                      <input
                        id={quietStartId}
                        type="number"
                        name="emailQuietStartUtc"
                        inputMode="numeric"
                        autoComplete="off"
                        min={0}
                        max={23}
                        step={1}
                        pattern="\d{1,2}"
                        aria-label="Quiet hours start (0-23 UTC)"
                        aria-describedby={quietCaptionId}
                        value={quietStart}
                        onChange={(ev) => setQuietStart(hourValue(ev.target.value, 0))}
                        onBlur={(ev) => setQuietStart(hourValue(ev.target.value, 0))}
                        className="ui-input w-16 text-center text-[15px] tabular-nums"
                      />
                      <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">:00</span>
                    </div>
                  </div>
                  <span aria-hidden className="flex min-h-11 items-center text-[var(--text-tertiary)]">
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={quietEndId} className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                      {SETTINGS_NOTIFICATIONS_STRINGS.quietEndLabel}
                    </label>
                    <div className="inline-flex items-center gap-1">
                      <input
                        id={quietEndId}
                        type="number"
                        name="emailQuietEndUtc"
                        inputMode="numeric"
                        autoComplete="off"
                        min={0}
                        max={23}
                        step={1}
                        pattern="\d{1,2}"
                        aria-label="Quiet hours end (0-23 UTC)"
                        aria-describedby={quietCaptionId}
                        value={quietEnd}
                        onChange={(ev) => setQuietEnd(hourValue(ev.target.value, 0))}
                        onBlur={(ev) => setQuietEnd(hourValue(ev.target.value, 0))}
                        className="ui-input w-16 text-center text-[15px] tabular-nums"
                      />
                      <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">:00</span>
                    </div>
                  </div>
                  <span id={quietCaptionId} className="sr-only">
                    Quiet window in UTC, {pad2(quietStart)}:00 to {pad2(quietEnd)}:00.
                  </span>
                </div>
              )}
            </div>

            <div role="group" aria-label={SETTINGS_NOTIFICATIONS_STRINGS.categoriesLegendSrOnly}>
              <div className="flex items-center justify-between gap-2">
                <p className="ui-caps-2 text-[var(--text-tertiary)]">Reminder events</p>
                {showCountChip ? (
                  <p
                    className="ui-caps-3 text-[var(--text-tertiary)]"
                    aria-label={`${enabledReminderCount} of ${totalReminderCount} reminder categories enabled`}
                  >
                    <span aria-hidden className="tabular-nums">
                      {enabledReminderCount}/{totalReminderCount} enabled
                    </span>
                  </p>
                ) : null}
              </div>

              <ul className="mt-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {reminderCategories.map((category) => (
                  <li key={category.key}>
                    <CategoryRow
                      category={category}
                      checked={selectedCategories.has(category.key as NotificationCategoryKey)}
                      onToggle={() => onToggleCategory(category.key as NotificationCategoryKey)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {digestCategory ? (
              <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
                <p className="ui-caps-2 text-[var(--text-tertiary)]">Digest</p>
                <div className="mt-1">
                  <CategoryRow
                    category={digestCategory}
                    checked={digestEnabled}
                    onToggle={() => onToggleCategory(digestCategory.key as NotificationCategoryKey)}
                  />
                </div>
              </div>
            ) : null}
          </fieldset>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-h-[1.25rem] min-w-0 items-center gap-2">
            <InlineMutationStatus message={error ?? message} variant={error ? "error" : "success"} className="text-sm" />
            {!error && !message && isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--warning-ink)]">
                <span
                  aria-hidden
                  className="inline-flex h-1.5 w-1.5 rounded-full"
                  style={{
                    background: "var(--warning-ink)",
                    boxShadow: "0 0 0 3px color-mix(in oklab, var(--warning-soft) 42%, transparent)",
                  }}
                />
                Unsaved changes
              </span>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
            {isDirty && canEdit ? (
              <button
                type="button"
                onClick={onDiscard}
                title="Discard"
                className="ui-btn-ghost inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm"
                aria-label={SETTINGS_NOTIFICATIONS_STRINGS.discardAnnouncement}
              >
                {SETTINGS_NOTIFICATIONS_STRINGS.discardLabel}
              </button>
            ) : null}
            <button
              type="submit"
              title={canEdit ? "Save (Ctrl+S)" : undefined}
              className="ui-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm billing-no-print disabled:cursor-not-allowed"
              aria-disabled={pending || !isDirty || formDisabled}
              disabled={!isDirty || formDisabled}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={2} aria-hidden />
                  <span>Saving...</span>
                </>
              ) : (
                SETTINGS_NOTIFICATIONS_STRINGS.saveLabel
              )}
            </button>
          </div>
        </footer>
      </form>
    </>
  );
}
