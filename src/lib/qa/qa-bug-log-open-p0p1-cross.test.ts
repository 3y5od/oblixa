import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type BugEntry = {
  id: string;
  severity: string;
  status: string;
};

function loadTsvOpenP0P1(): { hasY: boolean } {
  const p = path.join(process.cwd(), "scripts", "qa-route-coverage.tsv");
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const header = lines[0].split("\t");
  const idx = header.indexOf("open_p0p1");
  expect(idx).toBeGreaterThanOrEqual(0);
  let hasY = false;
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split("\t");
    while (cols.length < header.length) cols.push("");
    if (cols[idx]?.trim() === "y") hasY = true;
  }
  return { hasY };
}

function loadBugLog(): BugEntry[] {
  const p = path.join(process.cwd(), "scripts", "qa-bug-log.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as BugEntry[];
}

describe("qa-bug-log vs TSV open_p0p1", () => {
  it("TSV open_p0p1=y implies an open P0/P1 in bug log", () => {
    const { hasY } = loadTsvOpenP0P1();
    if (!hasY) return;
    const bugs = loadBugLog();
    const openHigh = bugs.some(
      (b) => b.status === "open" && (b.severity === "P0" || b.severity === "P1")
    );
    expect(openHigh).toBe(true);
  });

  it("when no TSV row has open_p0p1=y, bug log has no open P0/P1", () => {
    const { hasY } = loadTsvOpenP0P1();
    if (hasY) return;
    const bugs = loadBugLog();
    const openHigh = bugs.filter(
      (b) => b.status === "open" && (b.severity === "P0" || b.severity === "P1")
    );
    expect(openHigh).toEqual([]);
  });
});
