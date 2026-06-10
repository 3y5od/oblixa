"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiToggle } from "@/components/ui/ui-toggle";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { SettingsSubpageShell } from "@/components/settings/settings-subpage-shell";
import { SettingsCardHeader } from "@/components/settings/settings-card";
import { upsertNotificationSettingsForm } from "@/actions/notifications";
import {
  SETTINGS_NOTIFICATIONS_STRINGS,
  type NotificationCategoryKey,
} from "@/lib/settings/spec-strings";
import { secureRandomId } from "@/lib/security/random";
import type { OperationsSettingsPayload } from "./load-operations-settings-data";
import { NotificationsSummary } from "./notifications-summary";
import { NotificationsReadOnly } from "./notifications-readonly";

type PolicyChannel = {
  enabled?: unknown;
  quiet_hours_start_utc?: unknown;
  quiet_hours_end_utc?: unknown;
  blocked_types?: unknown;
};

type NotificationPolicy = {
  email?: PolicyChannel;
  slack?: PolicyChannel;
};

function asPolicy(value: unknown): NotificationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as NotificationPolicy;
}

function blockedTypes(channel: PolicyChannel | undefined): Set<string> {
  if (!Array.isArray(channel?.blocked_types)) return new Set();
  return new Set(channel.blocked_types.map((value) => String(value)));
}

function hourValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, Math.trunc(parsed)));
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// One compact setting row per reminder category: title + one-line description
// on the left, checkbox on the right. The whole row is the click target.
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

export function OperationsSettingsView({
  data,
  canEdit = true,
}: {
  data: OperationsSettingsPayload;
  canEdit?: boolean;
}) {
  const workflowSettings = data.workflowSettings;
  const policy = asPolicy(workflowSettings?.notification_policy_json);
  const initialEmailBlocked = useMemo(
    () => blockedTypes(policy.email),
    [policy.email]
  );
  const [initialEmailEnabled, setInitialEmailEnabled] = useState(
    policy.email?.enabled !== false
  );
  const [initialQuietStart, setInitialQuietStart] = useState(() =>
    hourValue(policy.email?.quiet_hours_start_utc, 0)
  );
  const [initialQuietEnd, setInitialQuietEnd] = useState(() =>
    hourValue(policy.email?.quiet_hours_end_utc, 0)
  );
  const [initialSelectedCategories, setInitialSelectedCategories] = useState<
    Set<NotificationCategoryKey>
  >(() => {
    const enabled = new Set<NotificationCategoryKey>();
    for (const cat of SETTINGS_NOTIFICATIONS_STRINGS.categories) {
      if (!initialEmailBlocked.has(cat.key)) enabled.add(cat.key);
    }
    return enabled;
  });

  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [selectedCategories, setSelectedCategories] = useState<
    Set<NotificationCategoryKey>
  >(() => new Set(initialSelectedCategories));
  const [quietStart, setQuietStart] = useState(initialQuietStart);
  const [quietEnd, setQuietEnd] = useState(initialQuietEnd);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [idempotencyKey] = useState(() => secureRandomId());

  const emailRemindersId = useId();
  const quietStartId = useId();
  const quietEndId = useId();
  const quietCaptionId = useId();
  const reminderDefaultsTitleId = "notifications-content-title";

  const isDirty = useMemo(
    () =>
      emailEnabled !== initialEmailEnabled ||
      quietStart !== initialQuietStart ||
      quietEnd !== initialQuietEnd ||
      !setsEqual(selectedCategories, initialSelectedCategories),
    [
      emailEnabled,
      quietStart,
      quietEnd,
      selectedCategories,
      initialEmailEnabled,
      initialQuietStart,
      initialQuietEnd,
      initialSelectedCategories,
    ]
  );

  // start === end → reminders send any time; start > end → overnight quiet
  // window (the server dispatcher compares modularly).
  const anyTime = quietStart === quietEnd;
  const overnight = quietStart > quietEnd;

  // Remember the last real window so toggling Any time ↔ Quiet window restores
  // the user's chosen hours instead of resetting them.
  const lastWindowRef = useRef<{ start: number; end: number }>(
    initialQuietStart !== initialQuietEnd
      ? { start: initialQuietStart, end: initialQuietEnd }
      : { start: 22, end: 7 }
  );
  useEffect(() => {
    if (quietStart !== quietEnd) {
      lastWindowRef.current = { start: quietStart, end: quietEnd };
    }
  }, [quietStart, quietEnd]);

  const selectAnyTime = useCallback(() => {
    // Collapse to a no-op window (start === end → reminders send any time).
    setQuietEnd(quietStart);
  }, [quietStart]);

  const selectWindow = useCallback(() => {
    if (quietStart !== quietEnd) return;
    const { start } = lastWindowRef.current;
    let end = lastWindowRef.current.end;
    if (start === end) end = (start + 8) % 24;
    setQuietStart(start);
    setQuietEnd(end);
  }, [quietStart, quietEnd]);

  const reminderCategoryKeys = useMemo(
    () =>
      SETTINGS_NOTIFICATIONS_STRINGS.categories
        .filter((c) => c.key !== "weekly_digest")
        .map((c) => c.key as NotificationCategoryKey),
    []
  );
  const enabledReminderCount = useMemo(
    () => reminderCategoryKeys.filter((k) => selectedCategories.has(k)).length,
    [reminderCategoryKeys, selectedCategories]
  );
  const totalReminderCount = reminderCategoryKeys.length;
  const showCountChip = enabledReminderCount < totalReminderCount;

  const prevCountRef = useRef(enabledReminderCount);
  useEffect(() => {
    if (prevCountRef.current === enabledReminderCount) return;
    prevCountRef.current = enabledReminderCount;
    const nextAnnouncement =
      enabledReminderCount === totalReminderCount
        ? "All reminder categories enabled"
        : `${enabledReminderCount} of ${totalReminderCount} reminder categories enabled`;
    const t = setTimeout(() => setAnnouncement(nextAnnouncement), 0);
    return () => clearTimeout(t);
  }, [enabledReminderCount, totalReminderCount]);

  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(undefined), 4000);
    return () => clearTimeout(t);
  }, [announcement]);

  // ⌘S / Ctrl+S keyboard shortcut.
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isDirty && !pending) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, pending, canEdit]);

  // Guard against navigating away with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!message || error) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message, error]);

  const toggleCategory = useCallback((key: NotificationCategoryKey) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleEmailToggle = useCallback((checked: boolean) => {
    setEmailEnabled(checked);
    setAnnouncement(
      checked
        ? SETTINGS_NOTIFICATIONS_STRINGS.channelOnAnnouncement
        : SETTINGS_NOTIFICATIONS_STRINGS.channelOffAnnouncement
    );
  }, []);

  const handleDiscard = useCallback(() => {
    setEmailEnabled(initialEmailEnabled);
    setQuietStart(initialQuietStart);
    setQuietEnd(initialQuietEnd);
    setSelectedCategories(new Set(initialSelectedCategories));
    setMessage(null);
    setError(null);
    setAnnouncement(SETTINGS_NOTIFICATIONS_STRINGS.discardAnnouncement);
  }, [
    initialEmailEnabled,
    initialQuietStart,
    initialQuietEnd,
    initialSelectedCategories,
  ]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void (async () => {
        const r = await upsertNotificationSettingsForm(formData);
        if ("error" in r) {
          setError(r.error);
          setAnnouncement(SETTINGS_NOTIFICATIONS_STRINGS.saveErrorAnnouncement);
          return;
        }
        setMessage(SETTINGS_NOTIFICATIONS_STRINGS.saveSuccessAnnouncement);
        setAnnouncement(SETTINGS_NOTIFICATIONS_STRINGS.saveSuccessAnnouncement);
        setInitialEmailEnabled(emailEnabled);
        setInitialQuietStart(quietStart);
        setInitialQuietEnd(quietEnd);
        setInitialSelectedCategories(new Set(selectedCategories));
      })();
    });
  }

  const categories = SETTINGS_NOTIFICATIONS_STRINGS.categories;
  const reminderCategories = categories.filter((c) => c.key !== "weekly_digest");
  const digestCategory = categories.find((c) => c.key === "weekly_digest");
  const digestEnabled = selectedCategories.has(
    "weekly_digest" as NotificationCategoryKey
  );

  const liveMsg =
    announcement ?? (pending ? "Saving preferences…" : error ?? undefined);

  const formDisabled = !canEdit;
  const segBase =
    "rounded-full px-3 py-1 text-[12px] font-medium transition-colors";
  const segActive =
    "bg-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--surface-raised))] text-[var(--accent-strong)]";
  const segIdle = "text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

  return (
    <SettingsSubpageShell
      icon={<Mail className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
      eyebrow={SETTINGS_NOTIFICATIONS_STRINGS.eyebrow}
      title={SETTINGS_NOTIFICATIONS_STRINGS.title}
      lead={SETTINGS_NOTIFICATIONS_STRINGS.lead}
      skipLink={{
        href: `#${reminderDefaultsTitleId}`,
        label: "Skip to notification settings",
      }}
    >
      <LiveRegion message={liveMsg} politeness={error ? "assertive" : "polite"} />

      {!canEdit ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--border-strong)_55%,var(--border-subtle))] bg-[var(--surface-muted)] px-4 py-3"
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-[var(--shadow-1)]"
          >
            <Lock className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0">
            <p className="ui-caps-2 text-[10.5px] leading-none text-[var(--text-secondary)]">
              {SETTINGS_NOTIFICATIONS_STRINGS.readOnlyTitle}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
              {SETTINGS_NOTIFICATIONS_STRINGS.nonAdminBanner}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {canEdit ? (
          <section
            id="notifications"
            className="ui-card-raised scroll-mt-6 overflow-hidden p-0"
          >
            <SettingsCardHeader
              icon={<Mail className="h-4 w-4" strokeWidth={1.85} />}
              title={SETTINGS_NOTIFICATIONS_STRINGS.sections.emailReminders}
              titleId={reminderDefaultsTitleId}
              badge={
                <span
                  role="img"
                  aria-label={
                    emailEnabled ? "Email channel: on" : "Email channel: off"
                  }
                >
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

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate
              className="billing-no-print"
            >
              <input type="hidden" name="idempotency_key" value={idempotencyKey} />

              <div className="space-y-5 px-5 py-5 sm:px-6">
                {/* Master switch — everything below depends on it. */}
                <UiToggle
                  name="emailEnabled"
                  label={SETTINGS_NOTIFICATIONS_STRINGS.emailRemindersToggleLabel}
                  checked={emailEnabled}
                  disabled={formDisabled}
                  ariaDescribedBy={emailRemindersId}
                  onChange={handleEmailToggle}
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

                  {/* Quiet hours — segmented Any time / Quiet window control. */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        id={`${quietStartId}-legend`}
                        className="text-[13px] font-medium text-[var(--text-secondary)]"
                      >
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
                      <button
                        type="button"
                        onClick={selectAnyTime}
                        aria-pressed={anyTime}
                        className={`${segBase} ${anyTime ? segActive : segIdle}`}
                      >
                        {SETTINGS_NOTIFICATIONS_STRINGS.summary.anyTime}
                      </button>
                      <button
                        type="button"
                        onClick={selectWindow}
                        aria-pressed={!anyTime}
                        className={`${segBase} ${!anyTime ? segActive : segIdle}`}
                      >
                        Quiet window
                      </button>
                    </div>

                    {anyTime ? (
                      <>
                        <p
                          id={quietCaptionId}
                          className="mt-2 text-[12px] leading-snug text-[var(--text-tertiary)]"
                        >
                          {SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption}
                        </p>
                        {/* Keep the values in the form even when no window is set. */}
                        <input type="hidden" name="emailQuietStartUtc" value={quietStart} />
                        <input type="hidden" name="emailQuietEndUtc" value={quietEnd} />
                      </>
                    ) : (
                      <div
                        className="mt-2.5 flex items-end gap-3"
                        role="group"
                        aria-labelledby={`${quietStartId}-legend`}
                      >
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={quietStartId}
                            className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]"
                          >
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
                              onChange={(ev) =>
                                setQuietStart(hourValue(ev.target.value, 0))
                              }
                              onBlur={(ev) =>
                                setQuietStart(hourValue(ev.target.value, 0))
                              }
                              className="ui-input w-16 text-center text-[15px] tabular-nums"
                            />
                            <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">
                              :00
                            </span>
                          </div>
                        </div>

                        <span
                          aria-hidden
                          className="flex min-h-11 items-center text-[var(--text-tertiary)]"
                        >
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </span>

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={quietEndId}
                            className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]"
                          >
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
                              onChange={(ev) =>
                                setQuietEnd(hourValue(ev.target.value, 0))
                              }
                              onBlur={(ev) =>
                                setQuietEnd(hourValue(ev.target.value, 0))
                              }
                              className="ui-input w-16 text-center text-[15px] tabular-nums"
                            />
                            <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">
                              :00
                            </span>
                          </div>
                        </div>

                        <span id={quietCaptionId} className="sr-only">
                          Quiet window in UTC, {pad2(quietStart)}:00 to{" "}
                          {pad2(quietEnd)}:00.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reminder events — two-column compact grid. */}
                  <div
                    role="group"
                    aria-label={
                      SETTINGS_NOTIFICATIONS_STRINGS.categoriesLegendSrOnly
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="ui-caps-2 text-[var(--text-tertiary)]">
                        Reminder events
                      </p>
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
                            checked={selectedCategories.has(
                              category.key as NotificationCategoryKey
                            )}
                            onToggle={() =>
                              toggleCategory(
                                category.key as NotificationCategoryKey
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Digest — separate from event reminders. */}
                  {digestCategory ? (
                    <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-4">
                      <p className="ui-caps-2 text-[var(--text-tertiary)]">Digest</p>
                      <div className="mt-1">
                        <CategoryRow
                          category={digestCategory}
                          checked={digestEnabled}
                          onToggle={() =>
                            toggleCategory(
                              digestCategory.key as NotificationCategoryKey
                            )
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </fieldset>
              </div>

              <footer className="flex flex-col gap-3 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_82%,transparent)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-h-[1.25rem] min-w-0 items-center gap-2">
                  <InlineMutationStatus
                    message={error ?? message}
                    variant={error ? "error" : "success"}
                    className="text-sm"
                  />
                  {!error && !message && isDirty ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--warning-ink)]">
                      <span
                        aria-hidden
                        className="inline-flex h-1.5 w-1.5 rounded-full"
                        style={{
                          background: "var(--warning-ink)",
                          boxShadow:
                            "0 0 0 3px color-mix(in oklab, var(--warning-soft) 42%, transparent)",
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
                      onClick={handleDiscard}
                      className="ui-btn-ghost inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm"
                      aria-label={SETTINGS_NOTIFICATIONS_STRINGS.discardAnnouncement}
                    >
                      {SETTINGS_NOTIFICATIONS_STRINGS.discardLabel}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    title={canEdit ? "Save (⌘S)" : undefined}
                    className="ui-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm billing-no-print disabled:cursor-not-allowed"
                    aria-disabled={pending || !isDirty || formDisabled}
                    disabled={!isDirty || formDisabled}
                  >
                    {pending ? (
                      <>
                        <Loader2
                          className="h-4 w-4 motion-safe:animate-spin"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>Saving…</span>
                      </>
                    ) : (
                      SETTINGS_NOTIFICATIONS_STRINGS.saveLabel
                    )}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        ) : (
          <NotificationsReadOnly
            emailEnabled={emailEnabled}
            selectedCategories={selectedCategories}
          />
        )}

        <NotificationsSummary
          emailEnabled={emailEnabled}
          quietStart={quietStart}
          quietEnd={quietEnd}
          enabledReminderCount={enabledReminderCount}
          totalReminderCount={totalReminderCount}
          digestEnabled={digestEnabled}
        />
      </div>
    </SettingsSubpageShell>
  );
}
