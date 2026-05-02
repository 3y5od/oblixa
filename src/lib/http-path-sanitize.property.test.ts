import fc from "fast-check";
import { describe, it, expect } from "vitest";

/** Collapse `.` / `..` segments for open-redirect hygiene spot checks (not full WHATWG URL). */
function collapsePathSegments(path: string): string {
  const raw = path.startsWith("/") ? path : `/${path}`;
  const parts = raw.split("/").filter((p) => p !== "" && p !== ".");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") {
      out.pop();
    } else {
      out.push(p);
    }
  }
  return `/${out.join("/")}`.replace(/\/+$/, "") || "/";
}

describe("http path segment collapse (fast-check)", () => {
  it("never produces .. after collapse for random segment lists", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "b", "seg", ".", "..", ""), { minLength: 0, maxLength: 24 }),
        (parts) => {
          const joined = "/" + parts.filter(Boolean).join("/");
          const c = collapsePathSegments(joined);
          expect(c.includes("/..")).toBe(false);
          expect(c.startsWith("/")).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
