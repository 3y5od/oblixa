import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("§17.3 extraction queued vs in-progress UI copy", () => {
  it("anchors distinct user-facing labels for pending vs processing jobs", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/extraction-job-alert.tsx"),
      "utf8"
    );
    expect(raw).toContain("Extraction queued");
    expect(raw).toContain("Extraction in progress");
    expect(raw).toMatch(/job\.status === "pending"/);
    expect(raw).toMatch(/job\.status === "processing"/);

    const buttonRaw = readFileSync(
      join(process.cwd(), "src/components/contracts/extract-button.tsx"),
      "utf8"
    );
    expect(buttonRaw).toContain("Extraction queued");
    expect(buttonRaw).toMatch(/extractionJob\?\.status === "pending"/);
  });
});
