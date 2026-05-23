import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getIntegrationTokenEncryptionKey } from "@/lib/env/server";

const TOKEN_PREFIX_V1 = "enc:v1:";
const TOKEN_PREFIX_V2 = "enc:v2:";
const TOKEN_KEY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isProductionLikeTokenEnv(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
}

function activeTokenKeyId(): string {
  const kid = process.env.OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID?.trim() || "default";
  if (!TOKEN_KEY_ID_RE.test(kid)) throw new Error("[env] Invalid OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID");
  return kid;
}

function tokenKeyEnvName(kid: string): string {
  return `OBLIXA_TOKEN_ENCRYPTION_KEY_${kid.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function keyForKid(kid: string): string {
  if (!TOKEN_KEY_ID_RE.test(kid)) throw new Error("Invalid encrypted token key id");
  const keyed = process.env[tokenKeyEnvName(kid)]?.trim();
  if (keyed) return keyed;
  if (kid === "default") return getIntegrationTokenEncryptionKey();
  throw new Error(`[env] Missing integration token encryption key for kid ${kid}`);
}

function decodeKey(kid = "default"): Buffer {
  const keyB64 = keyForKid(kid);
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "[env] integration token encryption key must decode to 32 bytes"
    );
  }
  return key;
}

export function encryptIntegrationToken(
  plaintext: string | null | undefined
): string | null {
  if (!plaintext) return null;
  const kid = activeTokenKeyId();
  const key = decodeKey(kid);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  const enc = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX_V2}${kid}:${iv.toString("base64")}:${tag.toString(
    "base64"
  )}:${enc.toString("base64")}`;
}

export function decryptIntegrationToken(
  ciphertext: string | null | undefined
): string | null {
  if (!ciphertext) return null;
  if (!ciphertext.startsWith(TOKEN_PREFIX_V1) && !ciphertext.startsWith(TOKEN_PREFIX_V2)) {
    if (isProductionLikeTokenEnv()) {
      throw new Error("Legacy plaintext integration token rejected in production");
    }
    return ciphertext;
  }

  if (ciphertext.startsWith(TOKEN_PREFIX_V1)) {
    const parts = ciphertext.slice(TOKEN_PREFIX_V1.length).split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted token format");
    }
    const [ivB64, tagB64, dataB64] = parts;
    const key = decodeKey("default");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64"),
      { authTagLength: 16 }
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  }

  const parts = ciphertext.slice(TOKEN_PREFIX_V2.length).split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted token format");
  }
  const [kid, ivB64, tagB64, dataB64] = parts;
  const key = decodeKey(kid);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
    { authTagLength: 16 }
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
