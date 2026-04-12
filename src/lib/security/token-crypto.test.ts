import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyB64 = Buffer.alloc(32, 7).toString("base64");

vi.mock("@/lib/env/server", () => ({
  getIntegrationTokenEncryptionKey: () => keyB64,
}));

describe("token-crypto", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("encryptIntegrationToken returns null for nullish plaintext", async () => {
    const { encryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(encryptIntegrationToken(null)).toBe(null);
    expect(encryptIntegrationToken(undefined)).toBe(null);
    expect(encryptIntegrationToken("")).toBe(null);
  });

  it("round-trips plaintext", async () => {
    const { encryptIntegrationToken, decryptIntegrationToken } = await import(
      "@/lib/security/token-crypto"
    );
    const plain = "integration-secret-token";
    const enc = encryptIntegrationToken(plain);
    expect(enc).toMatch(/^enc:v1:/);
    expect(decryptIntegrationToken(enc)).toBe(plain);
  });

  it("decryptIntegrationToken passes through legacy plaintext without prefix", async () => {
    const { decryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(decryptIntegrationToken("plain-old-token")).toBe("plain-old-token");
  });

  it("decryptIntegrationToken throws on malformed ciphertext", async () => {
    const { decryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(() => decryptIntegrationToken("enc:v1:bad")).toThrow("Invalid encrypted token format");
  });
});
