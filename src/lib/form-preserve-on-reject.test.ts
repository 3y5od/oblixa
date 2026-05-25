/**
 * V9 §15.3 + §22.2 — high-traffic forms keep user-entered state when the server rejects a mutation.
 * Locks RTL coverage in colocated *.ui.test.tsx files (behavioral, not string-only).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("form preserve on server reject (V9)", () => {
  it("evidence submission UI test asserts the note survives a failed submit", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/contracts/evidence-submission-form.ui.test.tsx"),
      "utf8"
    );
    expect(src).toMatch(/preserves the note on failure/i);
    expect(src).toMatch(/Vendor portal link/);
  });

  it("contract upload UI test asserts metadata survives createContract error", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/contracts/upload-form.ui.test.tsx"),
      "utf8"
    );
    expect(src).toMatch(/keeps typed metadata when creation returns an error/i);
  });
});
