import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATUS_LABELS, STATUS_SEMANTICS } from "./contracts";
import { NAV_ITEMS } from "./navigation";
import type { ContractStatus } from "@/lib/types";

/** v9 spec §24.1 — stable Core nouns (primary labels or primary child labels). */
const V9_CORE_VOCAB = [
  "Contracts",
  "Review",
  "Work",
  "Renewals",
  "Exceptions",
  "Evidence",
  "Reports",
] as const;

describe("V9 §24 consistency (vocabulary, status, filter URL contract)", () => {
  it("§24.1 primary navigation retains the seven stable nouns", () => {
    const primary = NAV_ITEMS.filter((i) => i.section === "primary");
    const visibleLabels = primary.flatMap((i) => [i.name, ...(i.navChildren ?? []).map((child) => child.name)]);
    for (const word of V9_CORE_VOCAB) {
      expect(
        visibleLabels.some((label) => label === word || label.includes(word)),
        `missing primary navigation label: ${word}`
      ).toBe(true);
    }
  });

  it("§24.3 contract status labels stay aligned with the semantics map (single source)", () => {
    const statuses = Object.keys(STATUS_SEMANTICS) as ContractStatus[];
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...statuses].sort());
    for (const s of statuses) {
      expect((STATUS_LABELS[s] ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("§24.4 contracts list keeps canonical filter keys wired for URL round-trip", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
    for (const key of [
      "exceptions",
      "review",
      "data_quality",
      "evidence",
      "deadline",
      "sort",
      "owner",
      "region",
      "status",
      "search",
      "page",
    ]) {
      expect(page, `searchParams type missing ${key}`).toContain(`${key}?:`);
    }
    expect(page).toContain("buildContractsListHref");
    expect(page).toContain("normalizeContractsSearchQuery");
  });
});
