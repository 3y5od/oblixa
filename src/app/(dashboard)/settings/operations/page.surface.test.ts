import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";

// Surface pins for the Notifications settings page (currently served at
// /settings/operations; canonical /settings/notifications move is tracked
// separately). Asserts against raw source so the design contract holds.

const DIR = "src/app/(dashboard)/settings/operations";
const pageSrc = readFileSync(join(process.cwd(), DIR, "page.tsx"), "utf8");
const viewSrc = readFileSync(join(process.cwd(), DIR, "operations-settings-view.tsx"), "utf8");
const readOnlySrc = readFileSync(join(process.cwd(), DIR, "notifications-readonly.tsx"), "utf8");
const summarySrc = readFileSync(join(process.cwd(), DIR, "notifications-summary.tsx"), "utf8");
const shellSrc = readFileSync(join(process.cwd(), "src/components/settings/settings-subpage-shell.tsx"), "utf8");
const specSrc = readFileSync(join(process.cwd(), "src/lib/settings/spec-strings.ts"), "utf8");
const actionSrc = readFileSync(join(process.cwd(), "src/actions/notifications.ts"), "utf8");
const globalsSrc = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("Notifications page — route + shell", () => {
  it("dynamic + noindex metadata, title from spec-strings", () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
    expect(pageSrc).toMatch(/title:\s*SETTINGS_NOTIFICATIONS_STRINGS\.title/);
    expect(pageSrc).toMatch(/description:\s*SETTINGS_NOTIFICATIONS_STRINGS\.lead/);
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("title stays 'Notifications' (no 'operations' framing in UI copy)", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.title).toBe("Notifications");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.lead.length).toBeLessThanOrEqual(80);
  });

  it("uses the shared SettingsSubpageShell (back pill + header + skip live there)", () => {
    expect(viewSrc).toContain('from "@/components/settings/settings-subpage-shell"');
    expect(viewSrc).toContain("<SettingsSubpageShell");
    expect(viewSrc).toContain("Skip to notification settings");
    expect(shellSrc).toContain("ui-skip-link");
    expect(shellSrc).toContain("Back to settings");
    expect(shellSrc).toContain("max-w-5xl");
  });

  it("form column gets a wider summary split (18rem rail)", () => {
    expect(viewSrc).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
  });

  it("no V1/V2/V3/V4 changelog comments remain in the view", () => {
    expect(viewSrc).not.toMatch(/\bV[1-4]\s*§/);
    expect(viewSrc).not.toMatch(/Issue #\d/);
  });
});

describe("Notifications page — email reminders card", () => {
  it("focal raised card with normalized SettingsCardHeader + ON/OFF badge", () => {
    expect(viewSrc).toMatch(/id="notifications"[\s\S]{0,80}ui-card-raised/);
    expect(viewSrc).toContain("<SettingsCardHeader");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.sections.emailReminders).toBe("Email reminders");
    expect(viewSrc).toMatch(/status=\{emailEnabled \? "healthy" : "disabled"\}/);
    expect(viewSrc).toMatch(/aria-label=\{[\s\S]{0,80}Email channel: on/);
    expect(SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOn).toBe("On");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOff).toBe("Off");
  });

  it("master switch is a UiToggle bound to emailEnabled", () => {
    expect(viewSrc).toContain('from "@/components/ui/ui-toggle"');
    expect(viewSrc).toMatch(/<UiToggle[\s\S]{0,200}name="emailEnabled"/);
    expect(viewSrc).toContain("handleEmailToggle");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.emailRemindersToggleLabel).toBe("Send reminders");
  });

  it("channel-off banner uses warning tones and sits below the toggle", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.channelOffBanner).toBe(
      "Email is off. No reminders will send."
    );
    expect(viewSrc).toMatch(/warning-soft[\s\S]{0,200}warning-ink/);
    const toggleIdx = viewSrc.indexOf("<UiToggle");
    const bannerIdx = viewSrc.indexOf("channelOffBanner");
    const fieldsetIdx = viewSrc.indexOf("disabled={!emailEnabled || formDisabled}");
    expect(bannerIdx).toBeGreaterThan(toggleIdx);
    expect(fieldsetIdx).toBeGreaterThan(bannerIdx);
  });
});

describe("Notifications page — quiet hours segmented control", () => {
  it("segments Any time / Quiet window instead of bare 0/0 inputs", () => {
    expect(viewSrc).toContain("selectAnyTime");
    expect(viewSrc).toContain("selectWindow");
    expect(viewSrc).toContain("summary.anyTime");
    expect(viewSrc).toContain("Quiet window");
    expect(viewSrc).toMatch(/const anyTime = quietStart === quietEnd/);
  });

  it("any-time hides the inputs but still submits the values via hidden inputs", () => {
    expect(viewSrc).toMatch(/anyTime \?[\s\S]{0,600}type="hidden" name="emailQuietStartUtc"/);
    expect(viewSrc).toContain("quietHoursNoneCaption");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption).toBe("Reminders send any time");
  });

  it("window mode shows hour steppers with a :00 UTC reading + overnight chip", () => {
    expect(viewSrc).toContain("quietStartLabel");
    expect(viewSrc).toContain("quietEndLabel");
    expect(viewSrc).toContain(":00");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.utcLabel).toBe("UTC");
    expect(viewSrc).toContain("summary.overnight");
    expect(viewSrc).toMatch(/const overnight = quietStart > quietEnd/);
  });

  it("quiet-hours inputs keep numeric semantics + clamp on blur", () => {
    expect(viewSrc).toMatch(/inputMode="numeric"/);
    expect(viewSrc).toMatch(/min=\{0\}/);
    expect(viewSrc).toMatch(/max=\{23\}/);
    expect(viewSrc).toMatch(/step=\{1\}/);
    expect(viewSrc).toMatch(/pattern="\\d\{1,2\}"/);
    expect(viewSrc).toMatch(/onBlur=\{\(ev\) =>[\s\S]{0,80}hourValue/);
    expect(viewSrc).toMatch(/name="emailQuietEndUtc"/);
    expect(globalsSrc).toMatch(/::-webkit-inner-spin-button[\s\S]{0,200}-webkit-appearance:\s*none/);
  });
});

describe("Notifications page — reminder categories", () => {
  it("required categories present", () => {
    const required = [
      "renewal_reminder",
      "notice_deadline",
      "field_review",
      "work_assignment",
      "evidence_request",
      "weekly_digest",
    ];
    const keys = SETTINGS_NOTIFICATIONS_STRINGS.categories.map((c) => c.key);
    for (const cat of required) expect(keys).toContain(cat);
    expect(specSrc).toContain("export type NotificationCategoryKey");
  });

  it("renders a two-column grid split into Reminder events + Digest", () => {
    expect(viewSrc).toMatch(/grid grid-cols-1 gap-x-6 sm:grid-cols-2/);
    expect(viewSrc).toContain("Reminder events");
    expect(viewSrc).toContain("Digest");
    expect(viewSrc).toContain("CategoryRow");
    expect(viewSrc).toContain('name="notificationCategories"');
  });

  it("category copy is release-safe", () => {
    const byKey = (k: string) =>
      SETTINGS_NOTIFICATIONS_STRINGS.categories.find((c) => c.key === k);
    expect(byKey("field_review")?.label).toBe("Details to confirm");
    expect(byKey("field_review")?.description).toBe(
      "When suggested contract details still need confirmation."
    );
    expect(byKey("work_assignment")?.label).toBe("Task assignments");
    expect(byKey("work_assignment")?.description).toBe(
      "When tasks are assigned or due dates approach."
    );
    expect(byKey("renewal_reminder")?.description).toBe(
      "Before approved renewal dates need a decision."
    );
    expect(byKey("weekly_digest")?.description).toBe("Weekly contract activity summary.");
    for (const cat of SETTINGS_NOTIFICATIONS_STRINGS.categories) {
      expect(cat.description).not.toMatch(/^Notify /);
    }
  });

  it("count chip renders only when partial", () => {
    expect(viewSrc).toContain("showCountChip");
    expect(viewSrc).toMatch(/enabledReminderCount < totalReminderCount/);
  });
});

describe("Notifications page — save footer", () => {
  it("dirty-state footer with discard + unsaved indicator", () => {
    expect(viewSrc).toMatch(/<footer[^>]*border-t/);
    expect(viewSrc).toContain("Unsaved changes");
    expect(viewSrc).toContain("discardLabel");
    expect(viewSrc).toMatch(/isDirty && canEdit \?[\s\S]{0,400}Discard/);
    expect(viewSrc).toMatch(/flex-col-reverse[\s\S]{0,100}sm:flex-row/);
  });

  it("Save is neutral when disabled (no faded-blue opacity-50)", () => {
    expect(viewSrc).toMatch(/disabled=\{!isDirty \|\| formDisabled\}/);
    expect(viewSrc).toMatch(/aria-disabled=\{pending \|\| !isDirty \|\| formDisabled\}/);
    expect(viewSrc).not.toContain("disabled:opacity-50");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.saveLabel).toBe("Save");
  });

  it("⌘S shortcut + beforeunload guard + Loader2 pending state", () => {
    expect(viewSrc).toMatch(/metaKey \|\| e\.ctrlKey/);
    expect(viewSrc).toContain("formRef.current?.requestSubmit()");
    expect(viewSrc).toContain('"beforeunload"');
    expect(viewSrc).toContain("Loader2");
    expect(viewSrc).toContain("motion-safe:animate-spin");
  });
});

describe("Notifications page — read-only + summary rail", () => {
  it("non-admins get a read-only view, not a disabled form", () => {
    expect(viewSrc).toMatch(/canEdit \?[\s\S]{0,40}<section/);
    expect(viewSrc).toContain("<NotificationsReadOnly");
    expect(viewSrc).toContain("nonAdminBanner");
    expect(readOnlySrc).toContain("StatusBadge");
    expect(readOnlySrc).not.toContain("ui-checkbox");
    expect(readOnlySrc).not.toContain('type="number"');
  });

  it("page passes canEdit based on role", () => {
    expect(pageSrc).toContain("isWorkspaceAdminRole(ctx.role)");
    expect(viewSrc).toMatch(/canEdit\s*=\s*true/);
  });

  it("summary rail reflects derived posture via shared chip primitives", () => {
    expect(viewSrc).toMatch(/<NotificationsSummary[\s\S]{0,400}digestEnabled=/);
    expect(summarySrc).toContain("StatusBadge");
    expect(summarySrc).toContain("RatioChip");
    expect(summarySrc).not.toContain("landing-eyebrow-dot");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.summary.title).toBe("Current setup");
  });
});

describe("Notifications page — server action + voice", () => {
  it("upsertNotificationSettingsForm preserves Slack + audits", () => {
    expect(actionSrc).toContain('"use server"');
    expect(actionSrc).toContain("export async function upsertNotificationSettingsForm");
    expect(viewSrc).toContain("upsertNotificationSettingsForm");
    expect(actionSrc).toContain("notification_policy_json");
    expect(actionSrc).toContain("preserveSlackPolicy");
    expect(actionSrc).toContain("idempotency_key");
    expect(actionSrc).toContain('"settings.notifications_updated"');
  });

  it("action gates on admin OR owner role", () => {
    expect(actionSrc).toMatch(/actorRole !== "admin"[\s\S]{0,40}actorRole !== "owner"/);
  });

  it("no banned vocabulary in SETTINGS_NOTIFICATIONS_STRINGS", () => {
    const forbidden = ["platform", "transformation", "governance", "autopilot", "intelligence"];
    const stringValues = JSON.stringify(SETTINGS_NOTIFICATIONS_STRINGS).toLowerCase();
    for (const f of forbidden) expect(stringValues).not.toContain(f);
  });
});
