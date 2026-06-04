import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC = join(process.cwd(), "e2e/authenticated.spec.ts");

describe("authenticated viewport navigation", () => {
  it("uses the retrying authenticated path helper in the viewport matrix", () => {
    const raw = readFileSync(SPEC, "utf8");
    const start = raw.indexOf('test("dashboard and contracts do not widen the document"');
    const body = raw.slice(start, raw.indexOf("});", start + 1));

    expect(body).toContain("gotoAuthenticatedPath(page, path)");
    expect(body).toContain('page.waitForLoadState("networkidle"');
    expect(body).toContain("page.waitForTimeout(100)");
    expect(body).not.toContain("page.goto(path");
  });
});
