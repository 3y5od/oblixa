import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_NOTIFICATIONS_STRINGS } from "@/lib/settings/spec-strings";

// SPEC: docs/notifications-page-v3-pass.md — V3 surface pins on top
// of V1/V2. V3 changes: all sub-card caps eyebrows dropped, helper
// prose removed, category descriptions recast, "Field reviews" →
// "Field approvals", "Save" replaces "Save preferences", "Open
// account" replaces "Adjust from account →", reduced-motion +
// prefers-contrast + Safari spinner CSS hooks, Discard button +
// ⌘S + spinner + beforeunload, single outer fieldset cascade.

const PAGE = join(
  process.cwd(),
  "src/app/(dashboard)/settings/operations/page.tsx"
);
const VIEW = join(
  process.cwd(),
  "src/app/(dashboard)/settings/operations/operations-settings-view.tsx"
);
const SPEC_STRINGS = join(process.cwd(), "src/lib/settings/spec-strings.ts");
const ACTION = join(process.cwd(), "src/actions/notifications.ts");
const GLOBALS = join(process.cwd(), "src/app/globals.css");

const pageSrc = readFileSync(PAGE, "utf8");
const viewSrc = readFileSync(VIEW, "utf8");
const specSrc = readFileSync(SPEC_STRINGS, "utf8");
const actionSrc = readFileSync(ACTION, "utf8");
const globalsSrc = readFileSync(GLOBALS, "utf8");

describe("Notifications page — release-state §1704-1723 compliance", () => {
  it("all 8 required content items present", () => {
    const requiredCategories = [
      "renewal_reminder",
      "notice_deadline",
      "field_review",
      "work_assignment",
      "evidence_request",
      "weekly_digest",
    ];
    const keys = SETTINGS_NOTIFICATIONS_STRINGS.categories.map((c) => c.key);
    for (const cat of requiredCategories) {
      expect(keys).toContain(cat);
    }
    // V3 — perUserCta retained but text changed to "Open account".
    expect(viewSrc).toContain("perUserCta");
    // V3 §1.1 — WORKSPACE eyebrow constant retained for backwards
    // compat but no longer rendered in the view.
    expect(SETTINGS_NOTIFICATIONS_STRINGS.eyebrows.workspace).toBe("WORKSPACE");
  });
});

describe("Notifications page — V1 maximal-pass defect fixes carried", () => {
  it("V1 §1.1 / §1.31 back-link in top-left as tertiary ghost", () => {
    expect(viewSrc).toMatch(/<Link\s+href="\/settings"[\s\S]{0,400}ui-btn-ghost/);
    expect(viewSrc).toMatch(/<ArrowLeft/);
  });

  it("V1 §1.2 lead ≤ 80 chars + scope-marking dropped", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.lead.length).toBeLessThanOrEqual(80);
    expect(SETTINGS_NOTIFICATIONS_STRINGS.lead).not.toContain("renewals, notice deadlines, field review");
  });

  it("V1 §1.3 metadata.description + robots set", () => {
    expect(pageSrc).toMatch(/description:\s*SETTINGS_NOTIFICATIONS_STRINGS\.lead/);
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("V1 §1.4 dynamic = 'force-dynamic'", () => {
    expect(pageSrc).toContain('export const dynamic = "force-dynamic"');
  });

  it("V1 §1.5 skip-to-content link present", () => {
    expect(viewSrc).toContain("Skip to notification settings");
    expect(viewSrc).toMatch(/ui-skip-link/);
  });

  it("V1 §1.6 h2 'Email reminders' retained", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.sections.emailReminders).toBe(
      "Email reminders"
    );
    expect(viewSrc).not.toContain("Reminder defaults");
  });

  it("V1 §1.22 form uses upsertNotificationSettingsForm (not upsertWorkflowSettingsForm)", () => {
    expect(viewSrc).toContain("upsertNotificationSettingsForm");
    expect(viewSrc).not.toContain("upsertWorkflowSettingsForm");
    expect(viewSrc).not.toMatch(/name="renewalHorizonDays"/);
    expect(viewSrc).not.toMatch(/name="staleContractDays"/);
    expect(viewSrc).not.toMatch(/name="rolePolicyJson"/);
    expect(viewSrc).not.toMatch(/name="slackEnabled"/);
  });

  it("V1 §1.30 root has max-w-4xl mx-auto", () => {
    expect(viewSrc).toMatch(/ui-page-stack mx-auto max-w-4xl/);
  });

  it("V1 §1.31 actions slot dropped from DashboardPageHeader", () => {
    expect(viewSrc).toMatch(/<DashboardPageHeader[\s\S]{0,1000}\/>/);
    expect(viewSrc).not.toMatch(/actions=\{<Link[\s\S]{0,200}backLabel/);
  });

  it("V1 §1.35 idempotency_key hidden input + state", () => {
    expect(viewSrc).toMatch(/name="idempotency_key"/);
    expect(viewSrc).toMatch(/idempotencyKey/);
  });
});

describe("Notifications page — V3 Tier 0 defects", () => {
  it("V3 §0.2 quietHoursNoneCaption drops bare middle-dot", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption).toBe(
      "Reminders send any time"
    );
    expect(SETTINGS_NOTIFICATIONS_STRINGS.quietHoursNoneCaption).not.toContain(" · ");
  });

  it("V3 §0.3 count chip is conditional (renders only when partial)", () => {
    expect(viewSrc).toContain("showCountChip");
    expect(viewSrc).toMatch(/enabledReminderCount < totalReminderCount/);
  });

  it("V3 §0.4 + §2.3 perUserCta is 'Open account' (no in-text arrow)", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.perUserCta).toBe("Open account");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.perUserCta).not.toContain("→");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.perUserCta).not.toContain("Adjust");
  });

  it("V3 §0.6 Per-user strip medallion uses UserRound (not Mail)", () => {
    expect(viewSrc).toContain("UserRound");
    // Mail still used for Email reminders card medallion, but not on
    // the per-user strip (UserRound differentiates the destination).
    expect(viewSrc).toMatch(/UserRound[\s\S]{0,400}strokeWidth/);
  });

  it("V3 §0.7 Save button block has no top divider", () => {
    // No border-t directly above the Save button block.
    expect(viewSrc).not.toMatch(
      /flex justify-end border-t border-\[color:color-mix\(in_oklab,var\(--border-subtle\)/
    );
  });
});

describe("Notifications page — V3 Tier 1 IA subtraction", () => {
  it("V3 §1.1 WORKSPACE eyebrow not rendered in view", () => {
    expect(viewSrc).not.toMatch(
      /eyebrows\.workspace[\s\S]{0,40}<\/p>/
    );
    expect(viewSrc).not.toContain('"WORKSPACE"');
  });

  it("V3 §1.2 REMINDER CATEGORIES eyebrow not rendered (sr-only legend only)", () => {
    expect(viewSrc).not.toMatch(
      /eyebrows\.reminderCategories/
    );
    expect(viewSrc).toContain("categoriesLegendSrOnly");
  });

  it("V3 §1.3 DIGEST eyebrow not rendered (weekly_digest inline with hairline)", () => {
    expect(viewSrc).not.toMatch(/eyebrows\.digest/);
    expect(viewSrc).not.toContain('"DIGEST"');
  });

  it("V3 §1.4 ACCOUNT eyebrow not rendered on Per-user strip", () => {
    expect(viewSrc).not.toMatch(/eyebrows\.account/);
  });

  it("V3 §1.5 emailRemindersToggleHelp not rendered in view", () => {
    expect(viewSrc).not.toContain("emailRemindersToggleHelp");
  });

  it("V3 §1.6 visible START/END caps labels not rendered (sr-only aria-labels used)", () => {
    expect(viewSrc).not.toContain("quietStartLabel");
    expect(viewSrc).not.toContain("quietEndLabel");
    expect(viewSrc).toContain('aria-label="Quiet hours start');
    expect(viewSrc).toContain('aria-label="Quiet hours end');
  });
});

describe("Notifications page — V3 Tier 2 copy & voice", () => {
  it("V3 §2.1 category descriptions drop 'Notify ...' prefix", () => {
    for (const cat of SETTINGS_NOTIFICATIONS_STRINGS.categories) {
      expect(cat.description).not.toMatch(/^Notify /);
    }
    const byKey = (k: string) =>
      SETTINGS_NOTIFICATIONS_STRINGS.categories.find((c) => c.key === k)
        ?.description;
    expect(byKey("renewal_reminder")).toBe(
      "Before approved renewal dates need a decision."
    );
    expect(byKey("notice_deadline")).toBe("Before notice windows close.");
    expect(byKey("field_review")).toBe(
      "When extracted fields still need approval."
    );
    expect(byKey("work_assignment")).toBe(
      "When work is assigned or due dates approach."
    );
    expect(byKey("evidence_request")).toBe("Before evidence is overdue.");
  });

  it("V3 §2.2 saveLabel is 'Save' (not 'Save preferences')", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.saveLabel).toBe("Save");
    expect(viewSrc).not.toContain("Save preferences");
  });

  it("V3 §2.5 channelOffBanner rewritten", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.channelOffBanner).toBe(
      "Email is off. No reminders will send."
    );
  });

  it("V3 §2.7 quietHoursHelp not rendered (constant retained for backwards compat)", () => {
    expect(viewSrc).not.toContain("quietHoursHelp");
  });
});

describe("Notifications page — V3 Tier 3 visual polish", () => {
  it("V3 §3.1 channel-state badge uses 'healthy' (on) / 'disabled' (off)", () => {
    expect(viewSrc).toMatch(/status=\{emailEnabled \? "healthy" : "disabled"\}/);
  });

  it("V3 §3.1 channel-state badge carries aria-label", () => {
    expect(viewSrc).toMatch(/aria-label=\{[\s\S]{0,80}Email channel: on/);
  });

  it("V3 §3.2 per-row icon medallions removed (no CATEGORY_ICONS map)", () => {
    expect(viewSrc).not.toContain("CATEGORY_ICONS");
    expect(viewSrc).not.toContain("CalendarClock");
    expect(viewSrc).not.toContain("ClipboardCheck");
    expect(viewSrc).not.toContain("BriefcaseBusiness");
    expect(viewSrc).not.toContain("FileCheck2");
    expect(viewSrc).not.toContain("Newspaper");
  });

  it("V3 §3.3 h2 size reduced to text-lg / [1.125rem]", () => {
    // Was V2 sm:text-[1.4rem]; now sm:text-[1.125rem] (text-lg).
    expect(viewSrc).not.toMatch(/sm:text-\[1\.4rem\]/);
    expect(viewSrc).toMatch(/text-\[15\.5px\][\s\S]{0,200}sm:text-\[1\.125rem\]/);
  });

  it("V3 §3.5 number inputs use w-20 sm:w-24 (responsive width)", () => {
    expect(viewSrc).toMatch(/ui-input w-20 tabular-nums sm:w-24/);
  });
});

describe("Notifications page — V3 Tier 4 form/save UX", () => {
  it("V3 §4.1 Discard button conditional on isDirty", () => {
    expect(viewSrc).toContain("discardLabel");
    expect(viewSrc).toMatch(/isDirty && canEdit \?[\s\S]{0,400}Discard/);
  });

  it("V3 §4.2 handleDiscard resets to initial values", () => {
    expect(viewSrc).toContain("handleDiscard");
    expect(viewSrc).toMatch(/setEmailEnabled\(initialEmailEnabled\)/);
    expect(viewSrc).toMatch(/setQuietStart\(initialQuietStart\)/);
    expect(viewSrc).toMatch(/setQuietEnd\(initialQuietEnd\)/);
  });

  it("V3 §4.3 ⌘S / Ctrl+S keyboard handler", () => {
    expect(viewSrc).toMatch(/metaKey \|\| e\.ctrlKey/);
    expect(viewSrc).toContain('e.key === "s"');
    expect(viewSrc).toContain("formRef.current?.requestSubmit()");
  });

  it("V3 §4.5 Loader2 spinner during pending", () => {
    expect(viewSrc).toContain("Loader2");
    expect(viewSrc).toContain("motion-safe:animate-spin");
  });

  it("V3 §4.6 aria-disabled vs disabled on Save", () => {
    expect(viewSrc).toMatch(/aria-disabled=\{pending \|\| !isDirty \|\| formDisabled\}/);
    expect(viewSrc).toMatch(/disabled=\{!isDirty \|\| formDisabled\}/);
  });

  it("V3 §4.7 formRef attached to form", () => {
    expect(viewSrc).toContain("useRef<HTMLFormElement>");
    expect(viewSrc).toMatch(/<form[\s\S]{0,40}ref=\{formRef\}/);
  });

  it("V3 §4.8 beforeunload guard when isDirty", () => {
    expect(viewSrc).toContain('"beforeunload"');
    expect(viewSrc).toMatch(/e\.returnValue = ""/);
  });
});

describe("Notifications page — V3 Tier 5 Per-user strip refactor", () => {
  it("V3 §5.1 strip becomes a Link covering full bounding box", () => {
    expect(viewSrc).toMatch(
      /<Link\s+href="\/settings\/account#notifications"[\s\S]{0,200}min-h-\[56px\]/
    );
  });

  it("V3 §5.4 focus-visible outline on the strip", () => {
    expect(viewSrc).toMatch(
      /focus-visible:outline-2[\s\S]{0,200}focus-visible:outline-\[color:color-mix/
    );
  });

  it("V3 §5.5 strip uses rounded-2xl (card radius)", () => {
    expect(viewSrc).toMatch(/<Link\s+href="\/settings\/account#notifications"[\s\S]{0,400}rounded-2xl/);
  });
});

describe("Notifications page — V3 Tier 12 input semantics", () => {
  it("V3 §12.1 inputMode='numeric' on quiet-hours inputs", () => {
    expect(viewSrc).toMatch(/inputMode="numeric"/);
  });

  it("V3 §12.2 min/max/step bounds set", () => {
    expect(viewSrc).toMatch(/min=\{0\}/);
    expect(viewSrc).toMatch(/max=\{23\}/);
    expect(viewSrc).toMatch(/step=\{1\}/);
  });

  it("V3 §12.3 autoComplete='off'", () => {
    expect(viewSrc).toMatch(/autoComplete="off"/);
  });

  it("V3 §12.4 tabular-nums on inputs", () => {
    expect(viewSrc).toMatch(/ui-input w-20 tabular-nums/);
  });

  it("V3 §12.5 onBlur clamps via hourValue", () => {
    expect(viewSrc).toMatch(/onBlur=\{\(ev\) =>[\s\S]{0,100}hourValue/);
  });

  it("V3 §12.8 pattern attribute", () => {
    expect(viewSrc).toMatch(/pattern="\\d\{1,2\}"/);
  });

  it("V3 §12.9 Safari/Webkit number-input spinner buttons hidden", () => {
    expect(globalsSrc).toMatch(/::-webkit-inner-spin-button[\s\S]{0,200}-webkit-appearance:\s*none/);
    expect(globalsSrc).toMatch(/\.ui-input\[type="number"\][\s\S]{0,200}appearance:\s*textfield/);
  });
});

describe("Notifications page — V3 Tier 13 copy consistency", () => {
  it("V3 §13.1 'Field reviews' label → 'Field approvals'", () => {
    const fieldCat = SETTINGS_NOTIFICATIONS_STRINGS.categories.find(
      (c) => c.key === "field_review"
    );
    expect(fieldCat?.label).toBe("Field approvals");
    // Description verb aligns with label noun.
    expect(fieldCat?.description).toContain("approval");
  });

  it("V3 §13.2 weekly digest description tightened", () => {
    const weekly = SETTINGS_NOTIFICATIONS_STRINGS.categories.find(
      (c) => c.key === "weekly_digest"
    );
    expect(weekly?.description).toBe("Weekly contract activity summary.");
  });

  it("V3 §13.3 channel-off banner positioned BELOW the toggle", () => {
    // The banner JSX renders after the toggle label and BEFORE the
    // outer disabled fieldset; check the source order.
    const toggleIdx = viewSrc.indexOf("emailRemindersId");
    const bannerIdx = viewSrc.indexOf("channelOffBanner");
    const fieldsetIdx = viewSrc.indexOf("disabled={!emailEnabled || formDisabled}");
    expect(toggleIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeGreaterThan(toggleIdx);
    expect(fieldsetIdx).toBeGreaterThan(bannerIdx);
  });

  it("V3 §13.4 badges use sentence case (not all-caps)", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOn).toBe("On");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.badges.emailOff).toBe("Off");
  });
});

describe("Notifications page — V3 Tier 15 mobile/touch", () => {
  it("V3 §15.1 toggle + category rows have min-h-[44px] touch targets", () => {
    expect(viewSrc).toMatch(/min-h-\[44px\]/);
  });

  it("V3 §15.2 Per-user strip min-h-[56px]", () => {
    expect(viewSrc).toMatch(/min-h-\[56px\]/);
  });

  it("V3 §15.3 Save/Discard mobile stacking (flex-col-reverse sm:flex-row)", () => {
    expect(viewSrc).toMatch(/flex-col-reverse[\s\S]{0,100}sm:flex-row/);
  });
});

describe("Notifications page — V3 Tier 16 channel-off cascade", () => {
  it("V3 §16.1 single outer fieldset wraps quiet hours + categories", () => {
    expect(viewSrc).toMatch(/<fieldset\s+disabled=\{!emailEnabled \|\| formDisabled\}/);
  });

  it("V3 §16.3 channel-off banner uses warning-soft tones", () => {
    expect(viewSrc).toMatch(/warning-soft[\s\S]{0,200}warning-ink/);
  });
});

describe("Notifications page — V3 Tier 18 perf & type safety", () => {
  it("V3 §18.1 isDirty memoized via useMemo", () => {
    expect(viewSrc).toMatch(/const isDirty = useMemo/);
  });

  it("V3 §18.2 NotificationCategoryKey union type exported", () => {
    expect(specSrc).toContain("export type NotificationCategoryKey");
    expect(specSrc).toContain('"renewal_reminder"');
    expect(specSrc).toContain('"weekly_digest"');
  });

  it("V3 §18.3 useCallback for stable handler identity", () => {
    expect(viewSrc).toContain("useCallback");
    expect(viewSrc).toMatch(/const toggleCategory = useCallback/);
    expect(viewSrc).toMatch(/const handleDiscard = useCallback/);
  });

  it("V3 §18.4 selectedCategories typed as Set<NotificationCategoryKey>", () => {
    expect(viewSrc).toMatch(/Set<\s*NotificationCategoryKey\s*>/);
  });
});

describe("Notifications page — V3 Tier 22 SR announcements", () => {
  it("V3 §22.1 saveSuccessAnnouncement string", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.saveSuccessAnnouncement).toBe(
      "Notification preferences saved"
    );
  });

  it("V3 §22.2 saveErrorAnnouncement string", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.saveErrorAnnouncement).toBe(
      "Failed to save notification preferences"
    );
  });

  it("V3 §22.3 channel toggle announcement state", () => {
    expect(viewSrc).toContain("channelOnAnnouncement");
    expect(viewSrc).toContain("channelOffAnnouncement");
    expect(viewSrc).toContain("handleEmailToggle");
  });

  it("V3 §22.4 discard announcement", () => {
    expect(viewSrc).toContain("discardAnnouncement");
  });

  it("V3 §22.5 count chip transition announcement", () => {
    expect(viewSrc).toContain("prevCountRef");
    expect(viewSrc).toMatch(/All reminder categories enabled/);
  });

  it("V3 §22.6 single shared LiveRegion mounted", () => {
    // Exactly one <LiveRegion> in the view.
    const matches = viewSrc.match(/<LiveRegion/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

describe("Notifications page — V3 Tier 8 authorization", () => {
  it("V3 §8.6 action gates on admin OR owner role", () => {
    expect(actionSrc).toMatch(/actorRole !== "admin"[\s\S]{0,40}actorRole !== "owner"/);
  });

  it("V3 §8.7 page passes canEdit prop based on role", () => {
    expect(pageSrc).toContain("canEdit");
    expect(pageSrc).toMatch(/role === "admin" \|\| role === "owner"/);
    expect(viewSrc).toMatch(/canEdit\s*=\s*true/);
  });

  it("V3 §8.7 read-only banner renders when !canEdit", () => {
    expect(viewSrc).toContain("nonAdminBanner");
    expect(SETTINGS_NOTIFICATIONS_STRINGS.nonAdminBanner).toContain(
      "workspace admins"
    );
  });

  it("V3 §8.8 audit log includes actorRole", () => {
    expect(actionSrc).toContain("actorRole");
  });
});

describe("Notifications page — V3 Tier 19/20 backend defensive + telemetry", () => {
  it("V3 §19.2 slack policy preservation re-audited", () => {
    expect(actionSrc).toContain("preserveSlackPolicy");
    expect(actionSrc).not.toContain("weekly_intake_lookback_days");
    expect(actionSrc).not.toContain("renewal_horizon_days");
    expect(actionSrc).not.toContain("role_policy_json");
  });

  it("V3 §19.3 unknown blocked_types preserved (forward-compat)", () => {
    expect(actionSrc).toContain("preserveUnknownBlockedTypes");
  });

  it("V3 §20.1 audit log includes diff payload", () => {
    expect(actionSrc).toContain("diff");
    expect(actionSrc).toMatch(/before:\s*before\.enabled/);
  });

  it("V3 §20.2 event taxonomy 'settings.notifications_updated'", () => {
    expect(actionSrc).toContain('"settings.notifications_updated"');
  });

  it("V3 §20.3 source: 'web' tagging", () => {
    expect(actionSrc).toContain('source: "web"');
  });
});

describe("Notifications page — V3 Tier 9 cross-page parity", () => {
  it("V3 §9.8 metadata title uses spec-strings constant", () => {
    expect(pageSrc).toMatch(/title:\s*SETTINGS_NOTIFICATIONS_STRINGS\.title/);
  });

  it("V3 §9.5 view uses DashboardPageHeader primitive", () => {
    expect(viewSrc).toContain("<DashboardPageHeader");
  });

  it("V3 §9.6 Email reminders card uses 32px CardMedallion", () => {
    expect(viewSrc).toContain("CardMedallion");
    expect(viewSrc).toMatch(/h-8 w-8/);
  });
});

describe("Notifications page — voice + spec-strings audit", () => {
  it("no banned vocabulary in SETTINGS_NOTIFICATIONS_STRINGS", () => {
    const forbidden = [
      "platform",
      "transformation",
      "governance",
      "autopilot",
      "intelligence",
    ];
    const stringValues = JSON.stringify(SETTINGS_NOTIFICATIONS_STRINGS);
    for (const f of forbidden) {
      expect(stringValues.toLowerCase()).not.toContain(f);
    }
  });

  it("lead doesn't repeat marketing tier names", () => {
    expect(SETTINGS_NOTIFICATIONS_STRINGS.lead.toLowerCase()).not.toContain(
      "public core"
    );
  });

  it("V3 §10.2 negative pins for removed strings", () => {
    expect(viewSrc).not.toContain("Save preferences");
    expect(viewSrc).not.toContain("Adjust from account");
    expect(viewSrc).not.toContain("Notify owners");
    expect(viewSrc).not.toContain("Notify reviewers");
    expect(viewSrc).not.toContain("Notify assignees");
    expect(viewSrc).not.toContain("Notify request");
    // The view itself doesn't render Reminders go to ... help line.
    expect(viewSrc).not.toContain(
      "Reminders go to owners, reviewers, and assignees."
    );
  });
});

describe("Notifications server action", () => {
  it("upsertNotificationSettingsForm exists + is server action", () => {
    expect(actionSrc).toContain('"use server"');
    expect(actionSrc).toContain(
      "export async function upsertNotificationSettingsForm"
    );
  });

  it("action updates only notification_policy_json (preserves Slack)", () => {
    expect(actionSrc).toContain("notification_policy_json");
    expect(actionSrc).toContain("preserveSlackPolicy");
  });

  it("action logs idempotency_key", () => {
    expect(actionSrc).toContain("idempotency_key");
  });

  it("action returns discriminated success | error", () => {
    expect(actionSrc).toMatch(/{\s*success:\s*true\s*}/);
    expect(actionSrc).toMatch(/{\s*error:\s*string\s*}/);
  });
});
