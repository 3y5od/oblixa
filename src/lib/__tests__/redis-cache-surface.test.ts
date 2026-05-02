import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("redis / ioredis cache surface (Phase 70)", () => {
  it("documents @upstash/redis usage via lockfile deps", () => {
    const lock = readFileSync(join(process.cwd(), "package-lock.json"), "utf8");
    expect(lock.includes("@upstash/redis") || lock.includes("ioredis")).toBe(true);
  });
});
