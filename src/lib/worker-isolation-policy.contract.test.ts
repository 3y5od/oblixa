import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("worker isolation policy config", () => {
  it("documents non-eval worker policy", async () => {
    const raw = await readFile(path.join(process.cwd(), "config", "worker-isolation.json"), "utf8");
    const j = JSON.parse(raw) as { workerScriptPolicy?: string };
    expect(j.workerScriptPolicy).toBeTruthy();
    expect(String(j.workerScriptPolicy)).not.toMatch(/\beval\b/i);
  });
});
