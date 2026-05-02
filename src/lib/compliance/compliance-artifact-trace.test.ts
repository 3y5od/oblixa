import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("compliance artifact traceability", () => {
  it("maps SOC2 / GDPR controls to existing test files", () => {
    const root = process.cwd();
    const raw = fs.readFileSync(path.join(root, "artifacts", "gdpr-soc2-control-map.json"), "utf8");
    const data = JSON.parse(raw) as { controls: { controlId: string; testPaths: string[] }[] };
    for (const row of data.controls) {
      for (const rel of row.testPaths) {
        const abs = path.join(root, rel);
        expect(fs.existsSync(abs), `${row.controlId} → ${rel}`).toBe(true);
      }
    }
  });
});
