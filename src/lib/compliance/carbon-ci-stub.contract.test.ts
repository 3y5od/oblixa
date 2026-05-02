import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("carbon-ci-stub artifact", () => {
  it("includes reporting fields", async () => {
    const raw = await readFile(path.join(process.cwd(), "artifacts", "carbon-ci-stub.json"), "utf8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof j.workflowMinutesEstimate).toBe("number");
    expect(typeof j.estimateKgCO2e).toBe("number");
    expect(typeof j.energyKWh).toBe("number");
    expect(typeof j.note).toBe("string");
  });
});
