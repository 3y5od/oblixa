import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Queued vs in-progress vs terminal suggestion copy stays explicit in the contract alert. */
describe("suggestion job alert state vocabulary", () => {
  it("distinguishes queued, running, success-with-partial-trust, and failed paths", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/extraction-job-alert.tsx"), "utf8");
    expect(src).toContain('job.status === "pending"');
    expect(src).toContain("Suggestions queued");
    expect(src).toContain('job.status === "processing"');
    expect(src).toContain("Suggestions in progress");
    expect(src).toContain('job.status === "succeeded"');
    expect(src).toContain("Suggestions completed");
    expect(src).toContain('job.status === "failed"');
    expect(src).toContain("Last suggestion run failed");
    expect(src).toContain("document.visibilityState");
  });
});
