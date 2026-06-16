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
import { Lock, Mail } from "lucide-react";
import { SettingsSubpageShell } from "@/components/settings/settings-subpage-shell";
import { LiveRegion } from "@/components/ui/live-region";
import { upsertNotificationSettingsForm } from "@/actions/notifications";
import {
  SETTINGS_NOTIFICATIONS_STRINGS,
  type NotificationCategoryKey,
} from "@/lib/settings/spec-strings";
import { secureRandomId } from "@/lib/security/random";
import type { OperationsSettingsPayload } from "./load-operations-settings-data";
import { NotificationsEmailForm } from "./notifications-email-form";
import { NotificationsSummary } from "./notifications-summary";
import { NotificationsReadOnly } from "./notifications-readonly";
import { asPolicy, blockedTypes, hourValue, setsEqual } from "./notifications-policy";

export function OperationsSettingsView({
  data,
  canEdit = true,
}: {
  data: OperationsSettingsPayload;
  canEdit?: boolean;
}) {
  const workflowSettings = data.workflowSettings;
  const policy = asPolicy(workflowSettings?.notification_policy_json);
  const initialEmailBlocked = useMemo(() => blockedTypes(policy.email), [policy.email]);
  // A workspace that has never saved a notification policy has no `blocked_types`
  // array. Opt-in categories (release-state: weekly digest is OFF by default) stay
  // unchecked for such workspaces; once the policy is configured, the explicit
  // blocklist is authoritative.
  const emailPolicyConfigured = Array.isArray(policy.email?.blocked_types);
  const [initialEmailEnabled, setInitialEmailEnabled] = useState(policy.email?.enabled !== false);
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
      if (initialEmailBlocked.has(cat.key)) continue;
      const optIn = "defaultOff" in cat && (cat as { defaultOff?: boolean }).defaultOff === true;
      if (optIn && !emailPolicyConfigured) continue;
      enabled.add(cat.key);
    }
    return enabled;
  });

  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [selectedCategories, setSelectedCategories] = useState<Set<NotificationCategoryKey>>(
    () => new Set(initialSelectedCategories)
  );
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

  const anyTime = quietStart === quietEnd;
  const overnight = quietStart > quietEnd;
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
  }, [initialEmailEnabled, initialQuietStart, initialQuietEnd, initialSelectedCategories]);

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
  const digestEnabled = selectedCategories.has("weekly_digest" as NotificationCategoryKey);
  const liveMsg = announcement ?? (pending ? "Saving preferences..." : error ?? undefined);
  const formDisabled = !canEdit;
  const segBase = "rounded-full px-3 py-1 text-[12px] font-medium transition-colors";
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
          <section id="notifications" className="ui-card-raised scroll-mt-6 overflow-hidden p-0">
            <NotificationsEmailForm
              formRef={formRef}
              idempotencyKey={idempotencyKey}
              emailEnabled={emailEnabled}
              formDisabled={formDisabled}
              emailRemindersId={emailRemindersId}
              quietStartId={quietStartId}
              quietEndId={quietEndId}
              quietCaptionId={quietCaptionId}
              reminderDefaultsTitleId={reminderDefaultsTitleId}
              quietStart={quietStart}
              quietEnd={quietEnd}
              anyTime={anyTime}
              overnight={overnight}
              selectedCategories={selectedCategories}
              reminderCategories={reminderCategories}
              digestCategory={digestCategory}
              digestEnabled={digestEnabled}
              showCountChip={showCountChip}
              enabledReminderCount={enabledReminderCount}
              totalReminderCount={totalReminderCount}
              pending={pending}
              error={error}
              message={message}
              isDirty={isDirty}
              canEdit={canEdit}
              segBase={segBase}
              segActive={segActive}
              segIdle={segIdle}
              onSubmit={handleSubmit}
              onEmailToggle={handleEmailToggle}
              onSelectAnyTime={selectAnyTime}
              onSelectWindow={selectWindow}
              onToggleCategory={toggleCategory}
              onDiscard={handleDiscard}
              setQuietStart={setQuietStart}
              setQuietEnd={setQuietEnd}
            />
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
