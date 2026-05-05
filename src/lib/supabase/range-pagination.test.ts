import { describe, expect, it, vi } from "vitest";
import { collectSupabaseRangePages, forEachSupabaseRangePage } from "./range-pagination";

function mockError(message: string) {
  return { message, details: "", hint: "", code: "PGRST000" } as const;
}

describe("collectSupabaseRangePages", () => {
  it("continues past multiple full pages before stopping on a later short page", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      if (from === 0) {
        expect(to).toBe(1);
        return { data: [{ id: 1 }, { id: 2 }], error: null };
      }
      if (from === 2) {
        expect(to).toBe(3);
        return { data: [{ id: 3 }, { id: 4 }], error: null };
      }
      if (from === 4) {
        expect(to).toBe(5);
        return { data: [{ id: 5 }], error: null };
      }
      return { data: [], error: null };
    });

    const { rows, error, truncated, nextOffset } = await collectSupabaseRangePages(fetchPage, {
      pageSize: 2,
      maxRows: 20,
    });

    expect(error).toBeNull();
    expect(truncated).toBe(false);
    expect(nextOffset).toBeNull();
    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("concatenates multiple full pages and a final short page", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      if (from === 0) {
        expect(to).toBe(2);
        return { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null };
      }
      if (from === 3) {
        expect(to).toBe(5);
        return { data: [{ id: 4 }], error: null };
      }
      return { data: [], error: null };
    });

    const { rows, error, truncated } = await collectSupabaseRangePages(fetchPage, {
      pageSize: 3,
      maxRows: 100,
    });

    expect(error).toBeNull();
    expect(truncated).toBe(false);
    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("returns truncated when maxRows hit on a full page", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ a: 1 }, { a: 2 }, { a: 3 }],
      error: null,
    }));

    const { rows, error, truncated } = await collectSupabaseRangePages(fetchPage, {
      pageSize: 3,
      maxRows: 3,
    });

    expect(error).toBeNull();
    expect(truncated).toBe(true);
    expect(rows).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates error and partial rows", async () => {
    const fetchPage = vi.fn(async (from: number) => {
      if (from === 0) return { data: [{ x: 1 }], error: null };
      return { data: null, error: mockError("boom") as never };
    });

    const { rows, error, truncated } = await collectSupabaseRangePages(fetchPage, {
      pageSize: 1,
      maxRows: 10,
    });

    expect(truncated).toBe(false);
    expect(rows).toEqual([{ x: 1 }]);
    expect(error?.message).toBe("boom");
  });
});

describe("forEachSupabaseRangePage", () => {
  it("keeps consuming after more than one full page and reports all rows seen", async () => {
    const chunks: number[][] = [];
    const fetchPage = vi.fn(async (from: number, to: number) => {
      if (from === 0) {
        expect(to).toBe(1);
        return { data: [1, 2], error: null };
      }
      if (from === 2) {
        expect(to).toBe(3);
        return { data: [3, 4], error: null };
      }
      return { data: [5], error: null };
    });

    const { error, stoppedByOffsetCap, rowsSeen, nextOffset } = await forEachSupabaseRangePage(
      fetchPage,
      (c) => {
        chunks.push([...c]);
      },
      { pageSize: 2 }
    );

    expect(error).toBeNull();
    expect(stoppedByOffsetCap).toBe(false);
    expect(rowsSeen).toBe(5);
    expect(nextOffset).toBeNull();
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("invokes consume per chunk until short page", async () => {
    const chunks: number[][] = [];
    const fetchPage = vi.fn(async (from: number, to: number) => {
      if (from === 0) {
        expect(to).toBe(1);
        return { data: [1, 2], error: null };
      }
      return { data: [3], error: null };
    });

    const { error, stoppedByOffsetCap } = await forEachSupabaseRangePage(
      fetchPage,
      (c) => {
        chunks.push([...c]);
      },
      { pageSize: 2 }
    );

    expect(error).toBeNull();
    expect(stoppedByOffsetCap).toBe(false);
    expect(chunks).toEqual([[1, 2], [3]]);
  });

  it("stops with stoppedByOffsetCap when max offset exceeded", async () => {
    let calls = 0;
    const fetchPage = vi.fn(async () => {
      calls += 1;
      return { data: [1, 2], error: null };
    });

    const { error, stoppedByOffsetCap } = await forEachSupabaseRangePage(
      fetchPage,
      () => {},
      { pageSize: 2, maxOffsetExclusive: 2 }
    );

    expect(error).toBeNull();
    expect(stoppedByOffsetCap).toBe(true);
    expect(calls).toBe(1);
  });
});
