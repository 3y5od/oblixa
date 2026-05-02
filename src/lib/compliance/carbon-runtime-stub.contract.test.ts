import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("carbon-ci-stub.runtime (when generated)", () => {
  it("parses optional runtime overlay if present", async () => {
    const p = path.join(process.cwd(), "artifacts", "carbon-ci-stub.runtime.json");
    const raw = await readFile(p, "utf8").catch(() => "");
    if (!raw) {
      expect(true).toBe(true);
      return;
    }
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof j.wallClockMinutesEstimate).toBe("number");
    expect(typeof j.runnerClass).toBe("string");
  });
});
