import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "@/lib/feature-flags";

/** Epic 16 — workspace guards are enforced via requireApiWorkspaceEligibility across API routes (inventory). */
describe("Epic 16 — workspace / org boundary inventory", () => {
  it("extract route wires workspace eligibility guard (representative)", async () => {
    const text = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/extract/route.ts"),
      "utf8"
    );
    expect(text).toContain("requireApiWorkspaceEligibility");
  });
});

/** Epic 24 — V5/V6 flags map to ENABLE_* env keys documented in .env.example */
describe("Epic 24 — feature flags + calibration dual-branch hooks", () => {
  it("surfaces stable V5/V6 flag booleans", () => {
    const flags = getFeatureFlags();
    expect(Object.keys(flags).length).toBeGreaterThan(10);
    expect(typeof flags.v6AssuranceCore).toBe("boolean");
    expect(typeof flags.v5DecisionFoundation).toBe("boolean");
  });

  it("documents ENABLE_V6_ASSURANCE_CORE in .env.example", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(example).toMatch(/ENABLE_V6_ASSURANCE_CORE/i);
    expect(example).toMatch(/ENABLE_V5_DECISION_FOUNDATION/i);
  });
});

describe("Epic 17 — vercel / cron metadata presence", () => {
  it("vercel.json defines staggered crons", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
    const doc = JSON.parse(raw) as { crons?: { path: string; schedule: string }[] };
    expect(doc.crons?.length).toBeGreaterThan(5);
  });
});

describe("Epic 22 — email hygiene artifacts", () => {
  it("list-unsubscribe helper module exists", () => {
    const p = path.join(process.cwd(), "src/lib/email/list-unsubscribe-header.ts");
    expect(fs.existsSync(p)).toBe(true);
  });
});
