import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src/app/api/external-actions");

/** Unauthenticated token-bearing POST handlers (passcode / submit ticket verification). */
const BEARER_STYLE_POST_ROUTES = [
  "[token]/submit/route.ts",
  "[token]/participant/workflow-step/route.ts",
];

describe("external-actions token routes (§17.2 static contract)", () => {
  it("bearer-style POST handlers use shared external verification helpers", () => {
    for (const rel of BEARER_STYLE_POST_ROUTES) {
      const raw = readFileSync(join(ROOT, rel), "utf8");
      expect(raw).toMatch(/export async function POST\(/);
      const hasVerify =
        raw.includes("verifyExternalSubmitTicket(") || raw.includes("verifyExternalPasscode(");
      expect(hasVerify, rel).toBe(true);
    }
  });

  it("internal workflow-step POST is session-governed (not anonymous token crypto)", () => {
    const raw = readFileSync(join(ROOT, "[token]/workflow-step/route.ts"), "utf8");
    expect(raw).toMatch(/export async function POST\(/);
    expect(raw.includes("getApiAuthContext(")).toBe(true);
    expect(raw.includes("requireApiWorkspaceEligibility(")).toBe(true);
  });
});
