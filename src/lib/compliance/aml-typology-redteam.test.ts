import { describe, expect, it } from "vitest";
import { sanitizeUploadedFileName } from "@/lib/security/upload-filename";

describe("AML / abuse filename typology vs sanitizer", () => {
  it("strips ASCII control characters from filenames", () => {
    const safe = sanitizeUploadedFileName("bad\x00wire.pdf");
    expect(safe.includes("\0")).toBe(false);
  });

  it("prevents path segments in filenames used as typology carriers", () => {
    expect(sanitizeUploadedFileName("../../etc/passwd")).toBe("passwd");
  });
});
