import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listNonEmptyDeadlinePresets } from "@/lib/contract-filters";
import {
  RENEWAL_LEGACY_HORIZON_ALIASES,
  normalizeRenewalWindow,
} from "@/lib/renewals/model";
import { RENEWAL_WINDOW_LABELS } from "@/lib/renewals/spec-strings";

describe("renewals legacy horizon compatibility", () => {
  it("keeps old contracts-list deadline presets accepted as aliases, without rendering horizon controls", () => {
    const contracts = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"),
      "utf8"
    );
    const renewals = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
      "utf8"
    );

    for (const preset of listNonEmptyDeadlinePresets()) {
      const needle = `"${preset}"`;
      expect(contracts, preset).toContain(needle);
      expect(RENEWAL_LEGACY_HORIZON_ALIASES[preset], preset).toBeDefined();
      expect(["30", "60", "90", "180"]).toContain(
        normalizeRenewalWindow({ horizon: preset })
      );
    }

    expect(Object.values(RENEWAL_WINDOW_LABELS)).toEqual(["30 days", "60 days", "90 days", "180 days"]);
    expect(renewals).not.toContain("name=\"horizon\"");
    expect(renewals).not.toContain("Shape the horizon");
  });
});
