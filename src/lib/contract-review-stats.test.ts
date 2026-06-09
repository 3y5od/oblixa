import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadReviewQueueSignals } from "@/lib/contract-review-stats";

const src = () => readFileSync(join(process.cwd(), "src/lib/contract-review-stats.ts"), "utf8");

describe("loadReviewQueueSignals (cross-page queue signals)", () => {
  it("is exported for the field-review model to build the full waiting queue", () => {
    expect(typeof loadReviewQueueSignals).toBe("function");
  });

  it("probes source-text presence by id only — never pulls the search_document blob over the wire", () => {
    const raw = src();
    // hasSourceText is a server-side null/empty filter, selecting only `id`.
    expect(raw).toContain('.not("search_document", "is", null)');
    expect(raw).toContain('.neq("search_document", "")');
    // The signal loader must NOT select the (up to ~120k char) document text;
    // only the active-contract detail (in model.ts) loads the blob.
    expect(raw).not.toMatch(/select\([^)]*search_document/);
  });

  it("scans pending fields with a bounded range and small columns", () => {
    const raw = src();
    expect(raw).toContain("REVIEW_SIGNAL_FIELD_SCAN_LIMIT");
    expect(raw).toContain('.eq("status", "pending")');
    // Heavy joins/text aren't needed for the signals — key-field + citation are
    // derived from small columns in one bounded fetch.
    expect(raw).toContain("field_name, source, created_at, field_value, source_snippet");
  });
});
