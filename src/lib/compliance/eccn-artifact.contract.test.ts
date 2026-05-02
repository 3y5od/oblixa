import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("ECCN / export control artifact", () => {
  it("eccn-feature-matrix.json parses", () => {
    const p = path.join(process.cwd(), "artifacts", "eccn-feature-matrix.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(j).toBeTruthy();
  });
});
