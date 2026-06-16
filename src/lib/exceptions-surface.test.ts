import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §14 exceptions — page + priority + mutation panels", () => {
  it("exceptions page composes mutation panels and server actions", () => {
    const page = [
      "src/app/(dashboard)/contracts/exceptions/page.tsx",
      "src/app/(dashboard)/contracts/exceptions/exceptions-page-view.tsx",
      "src/app/(dashboard)/contracts/exceptions/exception-ledger-row.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");
    expect(page).toContain("ExceptionMutationPanels");
    expect(page).toContain("WorkspaceRequiredState");
    expect(page).toContain("PermissionEligibilityHint");
    expect(page).toMatch(/EmptyState|RecoverableState/);
    expect(page).toMatch(/exceptions|exception/i);
  });

  it("keeps severity ordering helper on disk", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/exception-priority.ts"), "utf8");
    expect(raw.length).toBeGreaterThan(40);
  });
});
