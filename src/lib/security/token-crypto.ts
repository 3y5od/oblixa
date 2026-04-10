import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getIntegrationTokenEncryptionKey } from "@/lib/env/server";

const TOKEN_PREFIX = "enc:v1:";

function decodeKey(): Buffer {
  const keyB64 = getIntegrationTokenEncryptionKey();
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "[env] INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to 32 bytes"
    );
  }
  return key;
}

export function encryptIntegrationToken(
  plaintext: string | null | undefined
): string | null {
  if (!plaintext) return null;
  const key = decodeKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  const enc = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX}${iv.toString("base64")}:${tag.toString(
    "base64"
  )}:${enc.toString("base64")}`;
}

export function decryptIntegrationToken(
  ciphertext: string | null | undefined
): string | null {
  if (!ciphertext) return null;
  if (!ciphertext.startsWith(TOKEN_PREFIX)) {
    // Backward compatibility for old plaintext rows.
    return ciphertext;
  }
  const parts = ciphertext.slice(TOKEN_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = decodeKey();
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
