const RANDOM_HEX_ALPHABET = "0123456789abcdef";

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure random source unavailable");
  }
  return cryptoApi;
}

export function secureRandomHex(byteLength = 16): string {
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > 1024) {
    throw new Error("Invalid secure random byte length");
  }
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += RANDOM_HEX_ALPHABET[byte >>> 4] ?? "0";
    out += RANDOM_HEX_ALPHABET[byte & 0x0f] ?? "0";
  }
  return out;
}

export function secureRandomId(prefix?: string): string {
  const cryptoApi = getCrypto();
  const id =
    typeof cryptoApi.randomUUID === "function"
      ? cryptoApi.randomUUID()
      : secureRandomHex(16);
  return prefix ? `${prefix}-${id}` : id;
}

export function secureRandomFloat(): number {
  const bytes = new Uint32Array(1);
  getCrypto().getRandomValues(bytes);
  return (bytes[0] ?? 0) / 0x100000000;
}
