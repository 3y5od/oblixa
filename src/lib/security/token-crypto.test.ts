import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyB64 = Buffer.alloc(32, 7).toString("base64");
const nextKeyB64 = Buffer.alloc(32, 9).toString("base64");

vi.mock("@/lib/env/server", () => ({
  getIntegrationTokenEncryptionKey: () => keyB64,
}));

describe("token-crypto", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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
    expect(enc).toMatch(/^enc:v2:default:/);
    expect(decryptIntegrationToken(enc)).toBe(plain);
  });

  it("emits versioned token envelopes with explicit key ids", async () => {
    vi.stubEnv("OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID", "next");
    vi.stubEnv("OBLIXA_TOKEN_ENCRYPTION_KEY_NEXT", nextKeyB64);
    const { encryptIntegrationToken, decryptIntegrationToken } = await import(
      "@/lib/security/token-crypto"
    );
    const enc = encryptIntegrationToken("integration-secret-token");
    expect(enc).toMatch(/^enc:v2:next:/);
    expect(decryptIntegrationToken(enc)).toBe("integration-secret-token");
  });

  it("decryptIntegrationToken passes through legacy plaintext without prefix", async () => {
    const { decryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(decryptIntegrationToken("plain-old-token")).toBe("plain-old-token");
  });

  it("decryptIntegrationToken rejects legacy plaintext in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { decryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(() => decryptIntegrationToken("plain-old-token")).toThrow(
      "Legacy plaintext integration token rejected in production"
    );
  });

  it("decryptIntegrationToken throws on malformed ciphertext", async () => {
    const { decryptIntegrationToken } = await import("@/lib/security/token-crypto");
    expect(() => decryptIntegrationToken("enc:v1:bad")).toThrow("Invalid encrypted token format");
  });
});
