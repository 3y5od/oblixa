import { describe, expect, it } from "vitest";
import { NOTIFICATION_TAXONOMY } from "@/lib/notification-taxonomy";

describe("notification taxonomy", () => {
  it("keeps notification_type entries unique", () => {
    const seen = new Set<string>();
    for (const row of NOTIFICATION_TAXONOMY) {
      expect(seen.has(row.notificationType)).toBe(false);
      seen.add(row.notificationType);
    }
  });

  it("contains core, advanced, and assurance categories", () => {
    const tiers = new Set(NOTIFICATION_TAXONOMY.map((row) => row.tier));
    expect(tiers.has("core")).toBe(true);
    expect(tiers.has("advanced")).toBe(true);
    expect(tiers.has("assurance")).toBe(true);
  });
});
