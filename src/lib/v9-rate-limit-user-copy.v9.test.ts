import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeRecoverableMutationError } from "./recoverable-mutation-error";
import { interpretHttpMutationFailure } from "./v9-api-client-errors";

describe("V9 unified rate-limit user copy (§22.1)", () => {
  it("maps HTTP 429 to stable user-facing guidance", () => {
    const body = readFileSync(join(process.cwd(), "src/lib/v9-api-client-errors.ts"), "utf8");
    expect(body).toContain("429");
    expect(body).toContain("rate limited");
  });

  it("mirrors the same guidance when server actions surface 429 in text", () => {
    const fromHttp = interpretHttpMutationFailure({ status: 429 }).userMessage;
    expect(describeRecoverableMutationError("HTTP 429 Too Many Requests")).toBe(fromHttp);
    expect(describeRecoverableMutationError("Upstream rate limited")).toBe(fromHttp);
  });

  it("uses interpretHttpMutationFailure on evidence review + import retry fetch paths", () => {
    const evidence = readFileSync(
      join(process.cwd(), "src/components/contracts/evidence-submission-review-actions.tsx"),
      "utf8"
    );
    expect(evidence).toContain("interpretHttpMutationFailure");
    const retry = readFileSync(
      join(process.cwd(), "src/components/contracts/import-job-retry-button.tsx"),
      "utf8"
    );
    expect(retry).toContain("interpretHttpMutationFailure");
  });
});
