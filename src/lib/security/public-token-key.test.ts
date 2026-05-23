import { describe, expect, it } from "vitest";
import {
  publicTokenHash,
  publicTokenHashMatches,
  publicTokenMatches,
  publicTokenPrefix,
  publicTokenStableKey,
} from "./public-token-key";

describe("public token key helpers", () => {
  it("derives hash, prefix, and bounded stable enforcement key without exposing the raw token", () => {
    const token = "public-token-value";
    const hash = publicTokenHash(token);

    expect(hash).toHaveLength(64);
    expect(publicTokenPrefix(token)).toBe("public-token");
    expect(publicTokenStableKey(token)).toBe(hash.slice(0, 32));
    expect(publicTokenStableKey(token)).not.toContain(token);
  });

  it("matches stored token hashes without accepting wrong tokens", () => {
    const hash = publicTokenHash("token-a");

    expect(publicTokenHashMatches(hash, hash)).toBe(true);
    expect(publicTokenMatches({ token_hash: hash }, "token-a")).toBe(true);
    expect(publicTokenMatches({ token_hash: hash }, "token-b")).toBe(false);
    expect(publicTokenHashMatches("not-a-sha", hash)).toBe(false);
  });
});
