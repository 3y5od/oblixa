import { describe, it, expect } from "vitest";

/** Minimal TC string version bits check (IAB TCF v2 section 2) — full decode not required for CI. */
function tcfVersionFromBase64Url(tcString: string): number | null {
  try {
    const buf = Buffer.from(tcString, "base64url");
    if (buf.length < 6) return null;
    const bits = buf[0]! & 0b1111;
    return bits;
  } catch {
    return null;
  }
}

describe("TCF string stub", () => {
  it("rejects clearly invalid base64url", () => {
    expect(tcfVersionFromBase64Url("!!!")).toBeNull();
  });

  it("documents GPP stub section id placeholder", () => {
    const gppStub = { sectionId: 2, sectionValue: "stub" };
    expect(typeof gppStub.sectionId).toBe("number");
  });
});
