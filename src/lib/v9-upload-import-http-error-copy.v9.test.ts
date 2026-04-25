/**
 * V9 §17.2 + v9-api-client-errors — import/retry/evidence HTTP clients map failures through interpretHttpMutationFailure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("upload/import HTTP error mapping surfaces (V9)", () => {
  it("import job retry button maps fetch failures for user-visible copy", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/import-job-retry-button.tsx"),
      "utf8"
    );
    expect(raw).toContain("interpretHttpMutationFailure");
  });

  it("evidence review actions map HTTP failures consistently", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/contracts/evidence-submission-review-actions.tsx"),
      "utf8"
    );
    expect(raw).toContain("interpretHttpMutationFailure");
  });
});
