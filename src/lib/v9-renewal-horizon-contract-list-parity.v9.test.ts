import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listNonEmptyDeadlinePresets } from "@/lib/contract-filters";

describe("renewal horizon ↔ contracts deadline preset parity (§9.3 + §13)", () => {
  it("lists the same calendar preset tokens on contracts list and renewals horizon", () => {
    const contracts = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"),
      "utf8"
    );
    const renewals = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx"),
      "utf8"
    );
    for (const preset of listNonEmptyDeadlinePresets()) {
      const needle = `"${preset}"`;
      expect(contracts, preset).toContain(needle);
      expect(renewals, preset).toContain(needle);
    }
  });
});
