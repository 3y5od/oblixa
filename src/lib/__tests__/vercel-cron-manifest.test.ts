import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel cron manifest (Phase 7b)", () => {
  it("parses vercel.json", () => {
    const p = join(process.cwd(), "vercel.json");
    const raw = JSON.parse(readFileSync(p, "utf8")) as { crons?: unknown[] };
    expect(Array.isArray(raw.crons) || raw.crons === undefined).toBe(true);
  });
});
