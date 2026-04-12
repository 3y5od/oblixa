import { describe, expect, it } from "vitest";
import { sanitizeUploadedFileName } from "@/lib/security/upload-filename";

describe("sanitizeUploadedFileName", () => {
  it("uses basename after path separators", () => {
    expect(sanitizeUploadedFileName("a/b/c/document.pdf")).toBe("document.pdf");
    expect(sanitizeUploadedFileName("a\\b\\note.docx")).toBe("note.docx");
  });

  it("strips control characters", () => {
    expect(sanitizeUploadedFileName("hello\x00world.txt")).toBe("helloworld.txt");
    expect(sanitizeUploadedFileName("x\x1fy")).toBe("xy");
  });

  it("trims and caps at 255", () => {
    expect(sanitizeUploadedFileName("  x  ")).toBe("x");
    const long = "a".repeat(300);
    expect(sanitizeUploadedFileName(long).length).toBe(255);
  });

  it("falls back to document when empty after cleaning", () => {
    expect(sanitizeUploadedFileName("   ")).toBe("document");
    expect(sanitizeUploadedFileName("\x00\x01")).toBe("document");
  });
});
