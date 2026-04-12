import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("RATE_LIMITS catalog", () => {
  it("exports a bucket for every v4ReportPacksCron-style cron key used in src/app/api", () => {
    const srcRoot = join(process.cwd(), "src", "app", "api");
    const raw = readFileSync(join(srcRoot, "cron", "v4", "report-packs-generate", "route.ts"), "utf8");
    expect(raw).toContain("RATE_LIMITS.v4ReportPacksCron");
  });

  it("lists extract and extractWorker for extraction routes", () => {
    expect(RATE_LIMITS.extract.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.extractWorker.max).toBeGreaterThan(0);
  });
});
