import { describe, expect, it } from "vitest";
import {
  filterReviewQueueItems,
  normalizeReviewQueueFilter,
  reviewQueueFilterCounts,
  type FieldReviewQueueItem,
  type ReviewQueueFilter,
} from "@/lib/field-review/model";

function item(overrides: Partial<FieldReviewQueueItem> = {}): FieldReviewQueueItem {
  return {
    id: "c1",
    title: "Elevate HVAC Lease",
    counterparty: "Elevate HVAC",
    ownerLabel: "Elena Morris",
    ownerId: "user-1",
    updatedAt: "2026-06-01T00:00:00Z",
    pendingFields: 4,
    totalFields: 6,
    hasSourceText: true,
    nextNeedsCitation: false,
    hasKeyField: false,
    href: "/contracts/review?page=1&contract=c1",
    ...overrides,
  };
}

describe("normalizeReviewQueueFilter", () => {
  it("accepts every known filter key", () => {
    for (const k of ["all", "mine", "key", "no-source", "needs-citation"] as ReviewQueueFilter[]) {
      expect(normalizeReviewQueueFilter(k)).toBe(k);
    }
  });

  it("falls back to 'all' for unknown, missing, or empty values", () => {
    expect(normalizeReviewQueueFilter("bogus")).toBe("all");
    expect(normalizeReviewQueueFilter("MINE")).toBe("all"); // case-sensitive enum
    expect(normalizeReviewQueueFilter(undefined)).toBe("all");
    expect(normalizeReviewQueueFilter(null)).toBe("all");
    expect(normalizeReviewQueueFilter("")).toBe("all");
  });
});

describe("filterReviewQueueItems", () => {
  const items = [
    item({ id: "a", title: "Alpha MSA", counterparty: "Acme", ownerId: "user-1", hasKeyField: true, hasSourceText: true, nextNeedsCitation: false }),
    item({ id: "b", title: "Bravo Lease", counterparty: "Globex", ownerId: "user-2", hasKeyField: false, hasSourceText: false, nextNeedsCitation: false }),
    item({ id: "c", title: "Charlie NDA", counterparty: "Initech", ownerId: "user-1", hasKeyField: false, hasSourceText: true, nextNeedsCitation: true }),
  ];
  const ids = (list: FieldReviewQueueItem[]) => list.map((i) => i.id);

  it("'all' returns everything in order", () => {
    expect(ids(filterReviewQueueItems(items, { filter: "all" }))).toEqual(["a", "b", "c"]);
  });

  it("'mine' is viewer-scoped and empty without a viewer", () => {
    expect(ids(filterReviewQueueItems(items, { filter: "mine", viewerId: "user-1" }))).toEqual(["a", "c"]);
    expect(ids(filterReviewQueueItems(items, { filter: "mine", viewerId: null }))).toEqual([]);
  });

  it("'key' / 'no-source' / 'needs-citation' use the right attribute", () => {
    expect(ids(filterReviewQueueItems(items, { filter: "key" }))).toEqual(["a"]);
    expect(ids(filterReviewQueueItems(items, { filter: "no-source" }))).toEqual(["b"]);
    expect(ids(filterReviewQueueItems(items, { filter: "needs-citation" }))).toEqual(["c"]);
  });

  it("search matches title or counterparty case-insensitively and ANDs with the filter", () => {
    expect(ids(filterReviewQueueItems(items, { filter: "all", q: "globex" }))).toEqual(["b"]);
    expect(ids(filterReviewQueueItems(items, { filter: "all", q: "ALPHA" }))).toEqual(["a"]);
    expect(ids(filterReviewQueueItems(items, { filter: "mine", q: "charlie", viewerId: "user-1" }))).toEqual(["c"]);
    expect(ids(filterReviewQueueItems(items, { filter: "mine", q: "globex", viewerId: "user-1" }))).toEqual([]);
  });

  it("blank/whitespace search is a no-op", () => {
    expect(ids(filterReviewQueueItems(items, { filter: "all", q: "   " }))).toEqual(["a", "b", "c"]);
  });
});

describe("reviewQueueFilterCounts", () => {
  const items = [
    item({ id: "a", ownerId: "user-1", hasKeyField: true, hasSourceText: true, nextNeedsCitation: false }),
    item({ id: "b", ownerId: "user-2", hasKeyField: false, hasSourceText: false, nextNeedsCitation: false }),
    item({ id: "c", ownerId: "user-1", hasKeyField: false, hasSourceText: true, nextNeedsCitation: true }),
  ];

  it("counts each filter against the loaded items (search ignored)", () => {
    expect(reviewQueueFilterCounts(items, "user-1")).toEqual({
      all: 3,
      mine: 2,
      key: 1,
      "no-source": 1,
      "needs-citation": 1,
    });
  });

  it("'mine' count is zero without a viewer", () => {
    expect(reviewQueueFilterCounts(items, null).mine).toBe(0);
  });
});

describe("cross-page filtering (full waiting set)", () => {
  // The model now loads EVERY waiting contract, so filtering + counts must be
  // size-agnostic — a match on item #30 is found even though only ~25 render.
  const many = Array.from({ length: 30 }, (_, i) =>
    item({
      id: `c${i}`,
      title: `Contract ${i}`,
      counterparty: i === 29 ? "Zeta Holdings" : "Acme",
      ownerId: i % 2 === 0 ? "user-1" : "user-2",
      hasKeyField: i % 5 === 0,
      hasSourceText: i !== 17,
      nextNeedsCitation: i === 28,
    })
  );

  it("counts span the whole set, not just the first page", () => {
    expect(reviewQueueFilterCounts(many, "user-1")).toEqual({
      all: 30,
      mine: 15, // even indices 0..28
      key: 6, // 0, 5, 10, 15, 20, 25
      "no-source": 1, // index 17
      "needs-citation": 1, // index 28
    });
  });

  it("finds a match beyond the first rendered page", () => {
    const found = filterReviewQueueItems(many, { filter: "all", q: "zeta" });
    expect(found.map((i) => i.id)).toEqual(["c29"]);
  });
});
