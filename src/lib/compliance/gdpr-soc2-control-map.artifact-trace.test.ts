import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("gdpr-soc2-control-map artifact traceability", () => {
  it("each control lists at least one existing test file", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "artifacts", "gdpr-soc2-control-map.json"), "utf8");
    const j = JSON.parse(raw) as { controls: { controlId: string; testPaths?: string[] }[] };
    for (const row of j.controls) {
      const paths = row.testPaths ?? [];
      expect(paths.length, `${row.controlId} should declare testPaths`).toBeGreaterThan(0);
      for (const rel of paths) {
        const abs = path.join(process.cwd(), rel);
        expect(fs.existsSync(abs), `${row.controlId} missing ${rel}`).toBe(true);
      }
    }
  });
});
