import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * product-surface policy §14 — tripwire: contextual entry surfaces keep cross-links described in refinement-trace.
 */
const PROGRAMS = "src/app/(dashboard)/contracts/programs/page.tsx";
const CAMPAIGN_DETAIL = "src/app/(dashboard)/campaigns/[id]/page.tsx";
const RENEWALS = "src/app/(dashboard)/contracts/renewals/page.tsx";
const EXCEPTIONS = "src/app/(dashboard)/contracts/exceptions/page.tsx";
const EXCEPTIONS_ROW = "src/app/(dashboard)/contracts/exceptions/exception-ledger-row.tsx";
const WORK = "src/app/(dashboard)/work/page.tsx";

describe("refinement §14 contextual entry anchors", () => {
  it("renewals and exceptions pages import ContractContinuityLinks", () => {
    const renewals = [
      RENEWALS,
      "src/app/(dashboard)/contracts/renewals/renewal-row-cells.tsx",
    ]
      .map((rel) => readFileSync(join(process.cwd(), rel), "utf8"))
      .join("\n");
    const exceptions = [EXCEPTIONS, EXCEPTIONS_ROW]
      .map((rel) => readFileSync(join(process.cwd(), rel), "utf8"))
      .join("\n");
    expect(renewals.includes("ContractContinuityLinks"), RENEWALS).toBe(true);
    expect(exceptions.includes("ContractContinuityLinks"), EXCEPTIONS).toBe(true);
  });

  it("contract detail links account and counterparty relationship routes when keys exist", () => {
    const detailDir = join(process.cwd(), "src/app/(dashboard)/contracts/[id]");
    const raw = readdirSync(detailDir)
      .filter((file) => file === "page.tsx" || /^contract-detail.*\.(ts|tsx)$/.test(file))
      .sort()
      .map((file) => readFileSync(join(detailDir, file), "utf8"))
      .join("\n");
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
    const raw = [WORK, "src/app/(dashboard)/work/work-table.tsx"]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(raw).toContain("row.display.identity.linkedContract");
    expect(raw).toContain("contract.href");
    expect(raw).toContain("row.display.identity.title.href ?? row.href");
  });
});
