import { afterEach, describe, expect, it, vi } from "vitest";
import { secureRandomFloat, secureRandomHex, secureRandomId } from "@/lib/security/random";

const originalCrypto = globalThis.crypto;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("secure random helpers", () => {
  it("generates bounded random identifiers through Web Crypto", () => {
    const id = secureRandomId("rid");
    expect(id.startsWith("rid-")).toBe(true);
    expect(id.length).toBeGreaterThan("rid-".length);
  });

  it("generates hex with the requested byte length", () => {
    const hex = secureRandomHex(8);
    expect(hex).toMatch(/^[0-9a-f]{16}$/);
  });

  it("generates floats in the expected range", () => {
    const value = secureRandomFloat();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("fails closed when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => secureRandomId()).toThrow("Secure random source unavailable");
  });

  it("uses getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues(bytes: Uint8Array) {
        bytes.fill(0xab);
        return bytes;
      },
    });
    expect(secureRandomId()).toBe("abababababababababababababababab");
  });

  it("restores the original crypto object between tests", () => {
    expect(globalThis.crypto).toBe(originalCrypto);
  });
});
