import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** v9 spec §14.2 — severity, cause, owner, age/due, related contract, next action path */
describe("V9 §14.2 exception list required content (exceptions/page.tsx)", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/contracts/exceptions/page.tsx"),
    "utf8"
  );

  it("shows severity and status chips on each ledger row", () => {
    expect(page).toContain("item.severity");
    expect(page).toContain("item.status");
  });

  it("shows human-readable cause from exception_type", () => {
    expect(page).toContain("Cause:");
    expect(page).toContain("exception_type");
  });

  it("shows owner assignment state", () => {
    expect(page).toContain("ownerLabel");
    expect(page).toContain("owner");
  });

  it("shows age or due signal (due date + relative updated)", () => {
    expect(page).toContain("due_date");
    expect(page).toContain("formatDistanceToNowStrict");
    expect(page).toContain("updated_at");
  });

  it("links related contract title when contract_id present", () => {
    expect(page).toContain("/contracts/");
    expect(page).toContain("contractById");
  });

  it("surfaces next action path copy before mutation panels", () => {
    expect(page).toContain("nextStep");
    expect(page).toContain("ExceptionMutationPanels");
  });
});
