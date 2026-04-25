import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** §28 — telemetry failures must not throw to callers. */
describe("V9 product telemetry error handling", () => {
  it("emitProductTelemetryEvent wraps insert in try/catch and logs failures", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/product-telemetry.ts"), "utf8");
    expect(src).toContain("export async function emitProductTelemetryEvent");
    expect(src).toContain("try {");
    expect(src).toContain("} catch (e)");
    expect(src).toContain("[product-telemetry] insert failed");
    expect(src).toContain("[product-telemetry] insert threw");
  });
});
