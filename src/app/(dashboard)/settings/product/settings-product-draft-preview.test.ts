import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/feature-flags";
import { deriveProductSettingsDraftPreviewState } from "@/app/(dashboard)/settings/product/settings-product-draft-preview";

describe("settings product draft preview derivation", () => {
  it("reflects draft mode/search/mute changes before save", () => {
    const formData = new FormData();
    formData.set("workspace_mode", "core");
    formData.set("search_scope", "core_only");
    formData.set("mute_email_reminder_due", "on");

    const preview = deriveProductSettingsDraftPreviewState({
      formData,
      orgId: "org-1",
      featureFlags: getFeatureFlags(),
      initialBlockedTypes: [],
      baseMode: "advanced",
    });

    expect(preview.mode).toBe("core");
    expect(preview.searchScope).toBe("core_only");
    expect(preview.enabledNotificationTypes).not.toContain("reminder_due");
  });

  it("removes hidden advanced module nav labels in draft state", () => {
    const formData = new FormData();
    formData.set("workspace_mode", "advanced");
    formData.set("hide_decisions", "on");

    const preview = deriveProductSettingsDraftPreviewState({
      formData,
      orgId: "org-1",
      featureFlags: getFeatureFlags(),
      initialBlockedTypes: [],
      baseMode: "advanced",
    });

    expect(preview.navLabels).not.toContain("Decisions");
  });

  it("supports muting advanced notification categories in draft state", () => {
    const formData = new FormData();
    formData.set("workspace_mode", "advanced");
    formData.set("mute_email_campaign_digest", "on");

    const preview = deriveProductSettingsDraftPreviewState({
      formData,
      orgId: "org-1",
      featureFlags: getFeatureFlags(),
      initialBlockedTypes: [],
      baseMode: "advanced",
    });

    expect(preview.enabledNotificationTypes).not.toContain("campaign_digest");
  });
});
