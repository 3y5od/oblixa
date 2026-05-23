import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DASHBOARD = join(process.cwd(), "src/components/dashboard/core-dashboard.tsx");
const CORE_MODEL = join(process.cwd(), "src/lib/dashboard/core-dashboard-model.ts");

describe("dashboard surface filtering tripwires", () => {
  it("filters Core V10 read-model sources through visibility helpers", () => {
    const raw = readFileSync(CORE_MODEL, "utf8");
    expect(raw.includes("applyV10ReadModelVisibility")).toBe(true);
    expect(raw.includes('from("v10_work_items")')).toBe(true);
    expect(raw.includes('from("v10_evidence_request_statuses")')).toBe(true);
    expect(raw.includes('from("v10_contract_activity_events")')).toBe(true);
  });

  it("renders the fixed Core model surface instead of old upper/lower lanes", () => {
    const raw = readFileSync(CORE_DASHBOARD, "utf8");
    expect(raw.includes("model.topCards.map")).toBe(true);
    expect(raw.includes("orderedSections.map")).toBe(true);
    expect(raw.includes("getSection(model, \"review_queue\")")).toBe(true);
    expect(raw.includes("ContractTable")).toBe(false);
  });
});
