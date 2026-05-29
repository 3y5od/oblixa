import { describe, expect, it } from "vitest";
import {
  RELEASE_STATE_EMAIL_TEMPLATE_KEYS,
  RELEASE_STATE_EMAIL_TEMPLATES,
  getReleaseStateEmailTemplate,
} from "@/lib/release-state-email-templates";

const FORBIDDEN_PUBLIC_EMAIL_COPY = /\b(legal advice|autonomous|guaranteed extraction|never miss|complete enterprise assurance|GRC)\b/i;

describe("release-state email templates", () => {
  it("covers every launch lifecycle email with subject, body, and CTA", () => {
    expect(RELEASE_STATE_EMAIL_TEMPLATE_KEYS).toHaveLength(21);
    for (const key of RELEASE_STATE_EMAIL_TEMPLATE_KEYS) {
      const template = getReleaseStateEmailTemplate(key);
      expect(template.key).toBe(key);
      expect(template.subject.length).toBeGreaterThan(4);
      expect(template.preview.length).toBeGreaterThan(8);
      expect(template.body.length).toBeGreaterThan(20);
      expect(template.ctaLabel.length).toBeGreaterThan(3);
      expect(template.ctaHref).toMatch(/^\/[a-z0-9/?=&_-]*/i);
    }
  });

  it("pins required release-state subjects and CTAs", () => {
    expect(RELEASE_STATE_EMAIL_TEMPLATES.welcome_after_signup.subject).toBe("Welcome to Oblixa");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.welcome_after_signup.ctaLabel).toBe("Upload first contract");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.extraction_ready.subject).toBe("Your contract is ready for review");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.extraction_ready.ctaLabel).toBe("Review fields");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.upcoming_renewal_reminder.subject).toBe("Renewal date approaching");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.upcoming_renewal_reminder.ctaLabel).toBe("Review renewal");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.trial_ending_2_days.subject).toBe("Your Oblixa trial ends soon");
    expect(RELEASE_STATE_EMAIL_TEMPLATES.trial_ending_2_days.ctaLabel).toBe("Choose plan");
  });

  it("keeps public lifecycle email copy launch-safe", () => {
    for (const template of Object.values(RELEASE_STATE_EMAIL_TEMPLATES)) {
      const copy = `${template.subject}\n${template.preview}\n${template.body}\n${template.ctaLabel}`;
      expect(copy).not.toMatch(FORBIDDEN_PUBLIC_EMAIL_COPY);
    }
  });
});
