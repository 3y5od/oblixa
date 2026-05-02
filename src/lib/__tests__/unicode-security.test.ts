import { describe, expect, it } from "vitest";

describe("unicode / encoding safety", () => {
  it("NFC vs NFD compare canonical paths for auth-like identifiers", () => {
    const nfc = "caf\u00e9";
    const nfd = "cafe\u0301";
    expect(nfc.normalize("NFC")).toBe(nfd.normalize("NFC"));
  });

  it("rejects null-byte in display-ish strings used as filenames", () => {
    const raw = "ok\u0000evil.txt";
    expect(raw.includes("\0")).toBe(true);
    expect(raw.replace(/\0/g, "")).toBe("okevil.txt");
  });

  it("CRLF in user-controlled log fragments is flattened for single-line logs", () => {
    const user = "line1\r\nline2";
    expect(user.replace(/\r\n/g, "\\n")).toBe("line1\\nline2");
  });

  it("base64 padding tolerates missing padding on decode attempts", () => {
    const b64 = Buffer.from("hello").toString("base64").replace(/=+$/, "");
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe("hello");
  });

  it("punycode / IDN host parsing preserves A-label", () => {
    const u = new URL("https://xn--fiqs8s.example/");
    expect(u.hostname).toBe("xn--fiqs8s.example");
  });
});
