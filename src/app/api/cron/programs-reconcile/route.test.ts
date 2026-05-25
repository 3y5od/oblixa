import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

describe("versioned route compatibility alias", () => {
  it("re-exports the legacy handler without duplicating route logic", () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(currentDir, "route.ts"), "utf8");
    expect(source).toBe('export * from "../v4/programs-reconcile/route";\n');
  });
});
