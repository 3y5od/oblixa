import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/refinement.md §14 — tripwire: contextual entry surfaces keep cross-links described in refinement-trace.
 */
const CONTRACT_DETAIL = "src/app/(dashboard)/contracts/[id]/page.tsx";
const PROGRAMS = "src/app/(dashboard)/contracts/programs/page.tsx";
const CAMPAIGN_DETAIL = "src/app/(dashboard)/campaigns/[id]/page.tsx";
const RENEWALS = "src/app/(dashboard)/contracts/renewals/page.tsx";
const EXCEPTIONS = "src/app/(dashboard)/contracts/exceptions/page.tsx";
const WORK = "src/app/(dashboard)/work/page.tsx";

describe("refinement §14 contextual entry anchors", () => {
  it("renewals and exceptions pages import ContractContinuityLinks", () => {
    for (const rel of [RENEWALS, EXCEPTIONS] as const) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw.includes("ContractContinuityLinks"), rel).toBe(true);
    }
  });

  it("contract detail links account and counterparty relationship routes when keys exist", () => {
    const raw = readFileSync(join(process.cwd(), CONTRACT_DETAIL), "utf8");
    expect(raw).toContain("/accounts/");
    expect(raw).toContain("/counterparties/");
  });

  it("programs page links program evolution (Assurance contextual entry)", () => {
    const raw = readFileSync(join(process.cwd(), PROGRAMS), "utf8");
    expect(raw).toContain("/assurance/program-evolution");
  });

  it("campaign detail surfaces playbooks when Assurance nav is available", () => {
    const raw = readFileSync(join(process.cwd(), CAMPAIGN_DETAIL), "utf8");
    expect(raw).toContain("/assurance/playbooks");
  });

  it("work queue rows link to /contracts/[id] when contract_id is present", () => {
    const raw = readFileSync(join(process.cwd(), WORK), "utf8");
    expect(raw).toContain("row.contract_id ? `/contracts/${row.contract_id}`");
  });
});
