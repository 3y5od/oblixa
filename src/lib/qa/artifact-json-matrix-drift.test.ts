import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function collectJsonFiles(d: string, out: string[]) {
  if (!fs.existsSync(d)) return;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    if (ent.isDirectory()) collectJsonFiles(full, out);
    else if (ent.isFile() && ent.name.endsWith(".json")) out.push(full);
  }
}

describe("artifact JSON matrix drift", () => {
  it("parses every committed artifacts/**/*.json file", () => {
    const root = process.cwd();
    const dir = path.join(root, "artifacts");
    const files: string[] = [];
    collectJsonFiles(dir, files);
    files.sort();
    expect(files.length).toBeGreaterThan(10);
    for (const full of files) {
      const raw = fs.readFileSync(full, "utf8");
      expect(() => JSON.parse(raw), path.relative(root, full)).not.toThrow();
    }
  });
});
