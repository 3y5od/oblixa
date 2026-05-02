import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("maximal-security-closure-register", () => {
  it("every wired evidence path exists on disk (repo traceability)", () => {
    const root = path.join(__dirname, "../../..");
    const raw = fs.readFileSync(path.join(root, "config/maximal-security-closure-register.json"), "utf8");
    const j = JSON.parse(raw) as { phases: Record<string, { path: string }> };
    const missing: string[] = [];
    for (const [phaseId, row] of Object.entries(j.phases)) {
      const p = row.path.split("#")[0];
      if (p === "package.json") {
        if (!fs.existsSync(path.join(root, "package.json"))) missing.push(phaseId);
        continue;
      }
      const full = path.join(root, p);
      if (!fs.existsSync(full)) missing.push(`${phaseId} -> ${p}`);
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
