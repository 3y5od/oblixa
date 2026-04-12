import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("well-known static assets", () => {
  it("security.txt exists and is non-empty text", () => {
    const p = join(process.cwd(), "public", ".well-known", "security.txt");
    const raw = readFileSync(p, "utf8");
    expect(raw.trim().length).toBeGreaterThan(10);
    expect(raw.toLowerCase()).toContain("contact");
  });
});
