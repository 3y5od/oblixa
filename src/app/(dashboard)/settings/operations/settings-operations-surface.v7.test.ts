import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = join(process.cwd(), "src/app/(dashboard)/settings/operations/page.tsx");

describe("settings/operations surface (V7 §13 / §17)", () => {
  it("gates the page with auth and reads notification_policy_json from workflow settings", () => {
    const raw = readFileSync(PAGE, "utf8");
    expect(raw).toContain("getAuthContext");
    expect(raw).toContain("notification_policy_json");
    expect(raw).not.toMatch(/\bDecisions\b/);
    expect(raw).not.toMatch(/\bCampaigns\b/);
    expect(raw).not.toMatch(/\bAssurance\b/);
  });
});
