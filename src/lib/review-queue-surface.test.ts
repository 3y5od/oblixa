import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §11 review queue — throughput + save-next anchors", () => {
  it("field review module stays wired for extracted field editing", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/field-review.tsx"),
      "utf8"
    );
    expect(raw).toContain("FieldReview");
    expect(raw).toContain("getCriticalFieldReviewSummary");
    expect(raw).toMatch(/key date coverage still needs review/i);
    expect(raw.length).toBeGreaterThan(400);
  });

  it("anchors grouped critical-field UI coverage in field-review.ui.test", () => {
    const t = readFileSync(
      join(process.cwd(), "src/components/contracts/field-review.ui.test.tsx"),
      "utf8"
    );
    expect(t).toMatch(/date reminders need key dates/i);
  });

  it("contract detail keeps save-next telemetry link on review continuity strip", () => {
    const detailDir = join(process.cwd(), "src/app/(dashboard)/contracts/[id]");
    const raw = readdirSync(detailDir)
      .filter((file) => file === "page.tsx" || /^contract-detail.*\.(ts|tsx)$/.test(file))
      .sort()
      .map((file) => readFileSync(join(detailDir, file), "utf8"))
      .join("\n");
    expect(raw).toContain("ReviewSaveNextTelemetryLink");
    expect(raw).toContain("fetchReviewQueueContinuity");
  });

  it("review route page anchors queue entry", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/review/page.tsx"),
      "utf8"
    );
    expect(raw).toMatch(/review|queue|field/i);
    expect(raw).toContain("WorkspaceRequiredState");
    expect(raw).toContain("EmptyState");
  });
});
