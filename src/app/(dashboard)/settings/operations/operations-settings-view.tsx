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
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bell, Loader2, Lock, Mail } from "lucide-react";
import { DashboardPageHeader } from "@/components/ui/dashboard-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { LiveRegion } from "@/components/ui/live-region";
import { upsertNotificationSettingsForm } from "@/actions/notifications";
import {
  SETTINGS_NOTIFICATIONS_STRINGS,
  type NotificationCategoryKey,
} from "@/lib/settings/spec-strings";
import type { OperationsSettingsPayload } from "./load-operations-settings-data";
import { NotificationsSummary } from "./notifications-summary";
import { NotificationsReadOnly } from "./notifications-readonly";

// V4 polish (carries V1/V2/V3). Supersedes V3 where they conflict:
//   • Form is paired with a live summary rail (two-column at lg+) so the
//     page reads as one grid instead of a lone narrow column.
//   • Main card promoted to `.ui-card-raised`; Save/Discard live in a
//     card-footer action bar with an explicit unsaved-changes indicator.
//   • Non-admin state reads as a titled read-only notice + a read-only
//     footer; the editable Save/Discard cluster is hidden, not just
//     disabled, so locked controls never look editable.
//   • Quiet hours become a labeled time-range control (visible Start/End
//     + UTC chip + derived any-time / overnight chip), reversing the V3
//     "0 → 0" ambiguity.
//   • Reminder rows gain hover affordance + are deduped through
//     `CategoryRow`. Per-row icon medallions stay dropped (V3 §3.2).
//   • The dead "Open account" personal-overrides strip is removed: it
//     pointed at a non-existent route and there is no personal-preference
//     surface behind it. The rail's context line carries the "applies to
//     everyone" framing instead.

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

function CardMedallion({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_36%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
    >
      {children}
    </span>
  );
}

// V4 — one consistent setting row for every reminder category. The whole
// row is the click target (label wraps the checkbox); a hover tint makes
// the affordance obvious. No per-row icon medallion (V3 §3.2).
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
      className="-mx-2 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,transparent)]"
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="ui-checkbox mt-0.5"
        name="notificationCategories"
        value={category.key}
        checked={checked}
        onChange={onToggle}
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-[var(--text-primary)]">
          {category.label}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {category.description}
        </span>
      </span>
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
  // V4 — baselines are state, not frozen consts, so a successful save can
  // commit the saved values as the new baseline and clear isDirty (Save
  // disables, the unsaved indicator hides). handleDiscard still reverts to
  // these baselines, so after a save Discard reverts to the last-saved set.
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

  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const emailRemindersId = useId();
  const quietStartId = useId();
  const quietEndId = useId();
  const quietCaptionId = useId();
  const reminderDefaultsTitleId = "notifications-content-title";

  // V3 T18.1 — derived state via useMemo.
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

  // V3 T16.8 — when start === end (default 0/0), reminders send any
  // time. T16.6 — when start > end, overnight quiet range; server
  // dispatcher uses modular comparison. No UI special-case required.
  const quietHoursNoOp = quietStart === quietEnd;

  // V3 T18.1 — category counts excluding weekly_digest.
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
  // V3 T0.3 — chip only renders when partial.
  const showCountChip = enabledReminderCount < totalReminderCount;

  // V3 T22.5 — count transition announcement (skips initial mount).
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

  // V3 T22.x — clear transient announcements after 4s.
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(undefined), 4000);
    return () => clearTimeout(t);
  }, [announcement]);

  // V3 T4.3 — ⌘S / Ctrl+S keyboard shortcut.
  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "s" &&
        isDirty &&
        !pending
      ) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, pending, canEdit]);

  // V3 T4.8 — beforeunload guard when isDirty.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // V3 T4.4 — auto-clear saved-state confirmation after 3s.
  useEffect(() => {
    if (!message || error) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message, error]);

  // V3 T18.3 — useCallback for stable handler identity.
  const toggleCategory = useCallback((key: NotificationCategoryKey) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // V3 T22.3 — channel toggle announcement.
  const handleEmailToggle = useCallback((checked: boolean) => {
    setEmailEnabled(checked);
    setAnnouncement(
      checked
        ? SETTINGS_NOTIFICATIONS_STRINGS.channelOnAnnouncement
        : SETTINGS_NOTIFICATIONS_STRINGS.channelOffAnnouncement
    );
  }, []);

  // V3 T4.2 — handleDiscard resets to initial values.
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
          setAnnouncement(
            SETTINGS_NOTIFICATIONS_STRINGS.saveErrorAnnouncement
          );
          return;
        }
        setMessage(SETTINGS_NOTIFICATIONS_STRINGS.saveSuccessAnnouncement);
        setAnnouncement(
          SETTINGS_NOTIFICATIONS_STRINGS.saveSuccessAnnouncement
        );
        // Commit the saved values as the new baseline → isDirty clears.
        setInitialEmailEnabled(emailEnabled);
        setInitialQuietStart(quietStart);
        setInitialQuietEnd(quietEnd);
        setInitialSelectedCategories(new Set(selectedCategories));
      })();
    });
  }

  const categories = SETTINGS_NOTIFICATIONS_STRINGS.categories;
  const reminderCategories = categories.filter(
    (c) => c.key !== "weekly_digest"
  );
  const digestCategory = categories.find((c) => c.key === "weekly_digest");
  const digestEnabled = selectedCategories.has(
    "weekly_digest" as NotificationCategoryKey
  );

  const liveMsg =
    announcement ??
    (pending ? "Saving preferences…" : error ?? undefined);

  const formDisabled = !canEdit;

  return (
    <div className="ui-page-stack mx-auto max-w-5xl gap-4">
      <Link
        href={`#${reminderDefaultsTitleId}`}
        className="ui-skip-link sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-[var(--surface-raised)] focus:px-3 focus:py-2 focus:text-[var(--text-primary)]"
      >
        Skip to notification settings
      </Link>

      <Link
        href="/settings"
        className="ui-btn-ghost inline-flex max-w-max items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] billing-no-print"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {SETTINGS_NOTIFICATIONS_STRINGS.backLabel}
      </Link>

      <DashboardPageHeader
        icon={<Bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.85} />}
        eyebrow={SETTINGS_NOTIFICATIONS_STRINGS.eyebrow}
        title={SETTINGS_NOTIFICATIONS_STRINGS.title}
        lead={SETTINGS_NOTIFICATIONS_STRINGS.lead}
      />

      <LiveRegion
        message={liveMsg}
        politeness={error ? "assertive" : "polite"}
      />

      {/* V4 §3 — read-only (non-admin) state reads as a titled notice with
          an icon + tokenized surface, not a thin one-line banner. */}
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

      {/* V4 §5 + §IA — left column: editable form for admins, a read-only
          status view for everyone else (no editable-looking controls). Right
          column: the live summary rail, shown in both modes. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {canEdit ? (
        <section
          id="notifications"
          className="ui-card-raised scroll-mt-6 overflow-hidden p-0"
        >
          <header className="flex items-start justify-between gap-3 border-b border-[color:color-mix(in_oklab,var(--border-subtle)_80%,transparent)] px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <CardMedallion>
                <Mail className="h-4 w-4" strokeWidth={1.85} />
              </CardMedallion>
              <h2
                id={reminderDefaultsTitleId}
                className="min-w-0 text-[15.5px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[1.125rem]"
              >
                {SETTINGS_NOTIFICATIONS_STRINGS.sections.emailReminders}
              </h2>
            </div>
            <span
              role="img"
              aria-label={
                emailEnabled ? "Email channel: on" : "Email channel: off"
              }
              className="shrink-0"
            >
              <StatusBadge status={emailEnabled ? "healthy" : "disabled"}>
                <span aria-hidden>
                  {emailEnabled
                    ? SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOn
                    : SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOff}
                </span>
              </StatusBadge>
            </span>
          </header>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="billing-no-print"
          >
            <input
              type="hidden"
              name="idempotency_key"
              value={idempotencyKey}
            />

            <div className="space-y-5 px-5 py-5 sm:px-6">
              {/* Master switch — everything below depends on it. */}
              <label
                htmlFor={emailRemindersId}
                className="-mx-2 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,transparent)]"
              >
                <input
                  id={emailRemindersId}
                  type="checkbox"
                  className="ui-checkbox"
                  name="emailEnabled"
                  value="1"
                  checked={emailEnabled}
                  disabled={formDisabled}
                  onChange={(ev) => handleEmailToggle(ev.target.checked)}
                />
                <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                  {SETTINGS_NOTIFICATIONS_STRINGS.emailRemindersToggleLabel}
                </span>
              </label>

              {!emailEnabled ? (
                <p
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

                {/* Quiet hours — labeled time-range control. */}
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
                    {quietHoursNoOp ? (
                      <span className="ui-caps-3 ml-auto text-[10px] leading-none text-[var(--text-tertiary)]">
                        {SETTINGS_NOTIFICATIONS_STRINGS.summary.anyTime}
                      </span>
                    ) : quietStart > quietEnd ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,var(--surface-raised))] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--accent-strong)]">
                        {SETTINGS_NOTIFICATIONS_STRINGS.summary.overnight}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="mt-2.5 flex items-start gap-3"
                    role="group"
                    aria-labelledby={`${quietStartId}-legend`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                        {SETTINGS_NOTIFICATIONS_STRINGS.quietStartLabel}
                      </span>
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
                        placeholder="0–23"
                        aria-label="Quiet hours start (0-23 UTC)"
                        aria-describedby={quietCaptionId}
                        value={quietStart}
                        onChange={(ev) =>
                          setQuietStart(hourValue(ev.target.value, 0))
                        }
                        onBlur={(ev) =>
                          setQuietStart(hourValue(ev.target.value, 0))
                        }
                        className="ui-input w-20 tabular-nums sm:w-24 text-center text-[15px]"
                      />
                    </div>

                    <div className="flex flex-col gap-1" aria-hidden>
                      <span className="ui-caps-3 select-none text-[10px] leading-none text-transparent">
                        –
                      </span>
                      <span className="flex min-h-11 items-center text-[var(--text-tertiary)]">
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="ui-caps-3 text-[10px] leading-none text-[var(--text-tertiary)]">
                        {SETTINGS_NOTIFICATIONS_STRINGS.quietEndLabel}
                      </span>
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
                        placeholder="0–23"
                        aria-label="Quiet hours end (0-23 UTC)"
                        aria-describedby={quietCaptionId}
                        value={quietEnd}
                        onChange={(ev) => setQuietEnd(hourValue(ev.target.value, 0))}
                        onBlur={(ev) => setQuietEnd(hourValue(ev.target.value, 0))}
                        className="ui-input w-20 tabular-nums sm:w-24 text-center text-[15px]"
                      />
                    </div>
                  </div>

                  {quietHoursNoOp ? (
                    <span id={quietCaptionId} className="sr-only">
                      {SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption}
                    </span>
                  ) : (
                    <span id={quietCaptionId} className="sr-only">
                      {SETTINGS_NOTIFICATIONS_STRINGS.quietHoursLegend}
                    </span>
                  )}
                </div>

                {/* Reminder categories. */}
                <div
                  role="group"
                  aria-label={
                    SETTINGS_NOTIFICATIONS_STRINGS.categoriesLegendSrOnly
                  }
                >
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

                  <ul
                    className={`${
                      showCountChip ? "mt-3" : ""
                    } divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]`}
                  >
                    {reminderCategories.map((category) => (
                      <li key={category.key} className="py-1.5">
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

                    {digestCategory ? (
                      <li
                        key={digestCategory.key}
                        className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_88%,transparent)] py-1.5 pt-2.5"
                      >
                        <CategoryRow
                          category={digestCategory}
                          checked={digestEnabled}
                          onToggle={() =>
                            toggleCategory(
                              digestCategory.key as NotificationCategoryKey
                            )
                          }
                        />
                      </li>
                    ) : null}
                  </ul>
                </div>
              </fieldset>
            </div>

            {/* V4 §2 — card-footer action bar with explicit dirty state.
                Only admins render this section, so Save is always live here;
                non-admins get the read-only view (with its own locked footer). */}
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
                    className="ui-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm billing-no-print disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
