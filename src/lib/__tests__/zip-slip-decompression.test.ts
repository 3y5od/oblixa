import { describe, expect, it } from "vitest";

/** Reject paths that escape a extraction root (zip-slip style). */
export function isSafeArchiveMemberPath(root: string, memberPath: string): boolean {
  const norm = memberPath.replace(/\\/g, "/").replace(/^(\.\/)+/, "");
  if (norm.startsWith("/") || norm.includes("../")) return false;
  return !norm.split("/").some((seg) => seg === "..");
}

describe("zip-slip / path traversal (Phase 18)", () => {
  it("rejects parent segments", () => {
    expect(isSafeArchiveMemberPath("/tmp/out", "../etc/passwd")).toBe(false);
    expect(isSafeArchiveMemberPath("/tmp/out", "ok/file.txt")).toBe(true);
  });
});
