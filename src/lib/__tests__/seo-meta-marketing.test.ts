import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("marketing SEO roots", () => {
  it("root layout or metadata exports reference title capability", () => {
    const layout = join(process.cwd(), "src", "app", "layout.tsx");
    const text = readFileSync(layout, "utf8");
    expect(text.includes("metadata") || text.includes("title")).toBe(true);
  });
});
