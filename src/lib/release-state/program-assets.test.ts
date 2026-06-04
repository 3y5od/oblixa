import { describe, expect, it } from "vitest";
import {
  RELEASE_STATE_ACTIVATION_REQUIREMENTS,
  RELEASE_STATE_BEST_FIT_SIGNALS,
  RELEASE_STATE_DISCOVERY_NOTE_FIELDS,
  RELEASE_STATE_DISCOVERY_QUESTIONS,
  RELEASE_STATE_GRADUATION_CRITERIA,
  RELEASE_STATE_MANUAL_BOUNDARIES,
  RELEASE_STATE_OBJECTION_ANSWERS,
  RELEASE_STATE_POOR_FIT_SIGNALS,
  RELEASE_STATE_PUBLIC_PROMISE,
  RELEASE_STATE_PUBLIC_PAGES,
  RELEASE_STATE_SUPPORTING_PROMISE,
  classifyEarlyAccessFit,
} from "./program-assets";

describe("release-state program assets", () => {
  it("keeps the public promise exact and access-request oriented", () => {
    expect(RELEASE_STATE_PUBLIC_PROMISE).toBe("Track what signed contracts require next.");
    expect(RELEASE_STATE_SUPPORTING_PROMISE).toContain("review source-backed fields");
    expect(RELEASE_STATE_PUBLIC_PAGES.some((page) => page.path === "/request-access")).toBe(true);
  });

  it("covers qualification, discovery, objections, activation, graduation, and manual boundaries", () => {
    expect(RELEASE_STATE_BEST_FIT_SIGNALS).toContain("spreadsheet_folder_email_calendar_or_memory_tracker");
    expect(RELEASE_STATE_POOR_FIT_SIGNALS).toContain("drafting_redlining_negotiation_or_esignature_need");
    expect(RELEASE_STATE_DISCOVERY_QUESTIONS).toHaveLength(10);
    expect(RELEASE_STATE_DISCOVERY_NOTE_FIELDS).toContain("exactPhrases");
    expect(RELEASE_STATE_OBJECTION_ANSWERS.map((answer) => answer.id)).toEqual([
      "is_clm",
      "draft_redline_negotiate",
      "legal_advice",
      "renewal_guarantee",
      "security_questionnaire",
      "full_migration",
      "cost",
      "keep_spreadsheet",
    ]);
    expect(RELEASE_STATE_ACTIVATION_REQUIREMENTS).toContain("approve_source_backed_field");
    expect(RELEASE_STATE_GRADUATION_CRITERIA).toContain("pricing_tested_with_real_buyers");
    expect(RELEASE_STATE_MANUAL_BOUNDARIES).toContain("release_approval");
  });

  it("classifies fit without auto-approving customer access", () => {
    expect(
      classifyEarlyAccessFit({
        hasManualTracker: true,
        canShowCurrentProcess: true,
        hasTrackingPain: true,
        canStartSmall: true,
        requiresEnterpriseProcurement: false,
        needsLegalAdviceOrClm: false,
      })
    ).toBe("good_fit");
    expect(
      classifyEarlyAccessFit({
        hasManualTracker: true,
        canShowCurrentProcess: true,
        hasTrackingPain: true,
        canStartSmall: true,
        requiresEnterpriseProcurement: true,
        needsLegalAdviceOrClm: false,
      })
    ).toBe("poor_fit");
  });
});
