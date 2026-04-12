import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("next.config.ts smoke", () => {
  it("declares headers-related config (security surface)", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(raw).toContain("headers");
  });
});
