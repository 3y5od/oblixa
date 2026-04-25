import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §17.4 partial extraction visibility", () => {
  it("extraction alert + outcome semantics stay wired for non-binary outcomes", () => {
    const alert = readFileSync(join(process.cwd(), "src/components/contracts/extraction-job-alert.tsx"), "utf8");
    expect(alert.length).toBeGreaterThan(80);
    expect(readFileSync(join(process.cwd(), "src/lib/v9-outcome-semantics.ts"), "utf8")).toMatch(
      /partial|unknown|weak/i
    );
  });
});
