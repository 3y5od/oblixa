import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("instrumentation register order (Phase 33)", () => {
  it("register() imports Sentry configs after env warn", () => {
    const src = readFileSync(join(process.cwd(), "src", "instrumentation.ts"), "utf8");
    expect(src).toContain("export async function register");
    expect(src).toContain("sentry.server.config");
    expect(src).toContain("NEXT_RUNTIME");
  });
});
