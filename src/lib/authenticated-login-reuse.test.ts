import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC = join(process.cwd(), "e2e/authenticated.spec.ts");

describe("authenticated smoke login helper", () => {
  it("uses the session-aware authentication helper instead of forcing a fresh login", () => {
    const raw = readFileSync(SPEC, "utf8");
    const start = raw.indexOf("async function loginAsTestUser");
    const body = raw.slice(start, raw.indexOf("\n}", start) + 2);

    expect(body).toContain("ensureAuthenticatedSession");
    expect(body).not.toContain("loginWithCredentials");
  });
});
