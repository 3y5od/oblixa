import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** §17.3–17.4 — queued vs in-progress vs terminal extraction copy stays explicit in the contract alert. */
describe("V9 extraction job alert state vocabulary", () => {
  it("distinguishes queued, running, success-with-partial-trust, and failed paths", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/extraction-job-alert.tsx"), "utf8");
    expect(src).toContain('job.status === "pending"');
    expect(src).toContain("Extraction queued");
    expect(src).toContain('job.status === "processing"');
    expect(src).toContain("Extraction in progress");
    expect(src).toContain('job.status === "succeeded"');
    expect(src).toContain("Extraction completed");
    expect(src).toContain('job.status === "failed"');
    expect(src).toContain("Last extraction failed");
    expect(src).toContain("document.visibilityState");
  });
});
