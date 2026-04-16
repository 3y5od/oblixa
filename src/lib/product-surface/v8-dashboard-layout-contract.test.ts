import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBLIXA_PATHNAME_HEADER } from "@/lib/product-surface/v8-request-pathname";

/**
 * V8 §11.1 — dashboard shell must enforce page eligibility using the same pathname header the edge proxy sets.
 */
describe("v8 dashboard layout contract", () => {
  it("reads OBLIXA_PATHNAME_HEADER and calls assertPagePathEligibleOrNotFound", () => {
    const layoutPath = join(process.cwd(), "src/app/(dashboard)/layout.tsx");
    const raw = readFileSync(layoutPath, "utf8");
    expect(raw).toContain("assertPagePathEligibleOrNotFound");
    expect(raw).toContain("OBLIXA_PATHNAME_HEADER");
    expect(raw).toContain("headers(");
    expect(raw).toContain("notFound(");
  });

  it("proxy imports pathname header constant and sets it on next()", () => {
    const proxySrc = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxySrc).toContain("OBLIXA_PATHNAME_HEADER");
    expect(proxySrc).toContain("withOblixaPathname");
    expect(OBLIXA_PATHNAME_HEADER).toBe("x-oblixa-pathname");
  });

  it("uses proxy.ts as the sole edge entrypoint", () => {
    expect(existsSync(join(process.cwd(), "src/middleware.ts"))).toBe(false);
    const proxySrc = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxySrc).toContain("export async function proxy");
  });
});
