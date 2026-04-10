import { describe, expect, it } from "vitest";
import { diffPolicyJsonObjects } from "@/lib/v6/policy-json-diff";

describe("diffPolicyJsonObjects", () => {
  it("detects added, removed, and changed keys", () => {
    const d = diffPolicyJsonObjects({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(d.find((x) => x.key === "a")?.change).toBe("removed");
    expect(d.find((x) => x.key === "b")?.change).toBe("changed");
    expect(d.find((x) => x.key === "c")?.change).toBe("added");
  });
});
