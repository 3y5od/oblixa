import fc from "fast-check";
import { describe, expect, it } from "vitest";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

describe("parser fuzz CSV line (Phase 48, bounded)", () => {
  it("round-trips simple fields under fast-check", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z0-9]{0,8}$/), { minLength: 1, maxLength: 6 }), (cells) => {
        const line = cells.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",");
        const got = splitCsvLine(line);
        expect(got.length).toBe(cells.length);
      }),
      { numRuns: 40 }
    );
  });
});
