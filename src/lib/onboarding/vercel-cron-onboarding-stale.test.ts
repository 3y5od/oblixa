import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("vercel.json onboarding calibration stale cron", () => {
  it("lists /api/cron/v6/onboarding-calibration-stale (align with check:vercel-cron)", () => {
    const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    const data = JSON.parse(raw) as { crons?: { path?: string }[] };
    const paths = (data.crons ?? []).map((c) => c.path ?? "");
    expect(paths.some((p) => p === "/api/cron/v6/onboarding-calibration-stale")).toBe(true);
  });
});
