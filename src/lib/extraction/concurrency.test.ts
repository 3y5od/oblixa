import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/extraction/concurrency";

describe("mapWithConcurrency", () => {
  it("preserves order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (x) => x * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("returns empty for empty input", async () => {
    const results = await mapWithConcurrency(
      [],
      3,
      async () => {
        throw new Error("should not run");
      }
    );
    expect(results).toEqual([]);
  });
});
