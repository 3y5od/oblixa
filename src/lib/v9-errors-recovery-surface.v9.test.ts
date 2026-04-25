import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §22 errors and recovery — dashboard shell + HTTP mutation mapping", () => {
  it("dashboard error boundary keeps plain recovery copy and diagnostics hook", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/error.tsx"), "utf8");
    expect(raw).toMatch(/retry|again|reload|Try again/i);
    expect(raw).toContain("captureClientException");
  });

  it("root and global boundaries keep the same plain-language recovery posture", () => {
    const root = readFileSync(join(process.cwd(), "src/app/error.tsx"), "utf8");
    const global = readFileSync(join(process.cwd(), "src/app/global-error.tsx"), "utf8");
    expect(root).toContain("This page could not load");
    expect(root).toContain("captureClientException");
    expect(global).toContain("This page could not load");
    expect(global).toContain("captureClientException");
    expect(global).toMatch(/Try again|Refresh/i);
  });

  it("HTTP mutation failure mapper stays available for rate limits and payload errors", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/v9-api-client-errors.ts"), "utf8");
    expect(raw).toContain("interpretHttpMutationFailure");
    expect(raw.length).toBeGreaterThan(80);
  });
});
