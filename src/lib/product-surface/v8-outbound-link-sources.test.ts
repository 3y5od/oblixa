import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EXPECTED_ALLOWLIST = [
  "src/lib/v5/control-room-dashboard.ts",
  "src/lib/v6/review-board-notifications.ts",
] as const;

function readAllowlistRows(): string[] {
  const p = path.join(process.cwd(), "scripts/v7-href-audit-allowlist.txt");
  return readFileSync(p, "utf8")
    .split("\n")
    .map((line) => line.split("#")[0]?.trim() ?? "")
    .filter(Boolean);
}

describe("v8 outbound/server-generated link sources (§5.6, §16)", () => {
  it("keeps href audit allowlist narrow and explicit", () => {
    const rows = readAllowlistRows().sort();
    expect(rows).toEqual([...EXPECTED_ALLOWLIST].sort());
    for (const rel of rows) {
      expect(existsSync(path.join(process.cwd(), rel)), `missing allowlist file ${rel}`).toBe(true);
    }
  });
});

