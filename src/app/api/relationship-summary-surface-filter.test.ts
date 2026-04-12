import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ACCOUNT_SUMMARY = join(process.cwd(), "src/app/api/accounts/[key]/summary/route.ts");
const COUNTERPARTY_SUMMARY = join(process.cwd(), "src/app/api/counterparties/[key]/summary/route.ts");

describe("relationship summary API surface filtering", () => {
  it("applies workspace eligibility and timeline filtering for account summaries", async () => {
    const raw = await readFile(ACCOUNT_SUMMARY, "utf8");
    expect(raw.includes("requireApiWorkspaceEligibility")).toBe(true);
    expect(raw.includes("const filteredTimelineEvents")).toBe(true);
    expect(raw.includes("timelineEvents: filteredTimelineEvents")).toBe(true);
  });

  it("applies workspace eligibility and timeline filtering for counterparty summaries", async () => {
    const raw = await readFile(COUNTERPARTY_SUMMARY, "utf8");
    expect(raw.includes("requireApiWorkspaceEligibility")).toBe(true);
    expect(raw.includes("const filteredTimelineEvents")).toBe(true);
    expect(raw.includes("timelineEvents: filteredTimelineEvents")).toBe(true);
  });
});
