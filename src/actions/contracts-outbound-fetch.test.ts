import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contracts extraction outbound path", () => {
  it("uses safeFetch with dev-localhost allowance for internal extract API hops", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/contracts.ts"), "utf8");
    expect(raw).toContain('import { safeFetch } from "@/lib/security/safe-fetch"');
    expect(raw).toContain("allowLocalhostInDev: true");
    expect(raw).not.toContain("fetch(`${appUrl}/api/extract`");
  });
});