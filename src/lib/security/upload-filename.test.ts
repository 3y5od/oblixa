import { describe, expect, it } from "vitest";
import {
  UPLOADED_FILE_NAME_MAX_LENGTH,
  sanitizeUploadedFileName,
  validateUploadedFileName,
} from "@/lib/security/upload-filename";

describe("sanitizeUploadedFileName", () => {
  it("uses basename after path separators", () => {
    expect(sanitizeUploadedFileName("a/b/c/document.pdf")).toBe("document.pdf");
    expect(sanitizeUploadedFileName("a\\b\\note.docx")).toBe("note.docx");
  });

  it("strips control characters", () => {
    expect(sanitizeUploadedFileName("hello\x00world.txt")).toBe("helloworld.txt");
    expect(sanitizeUploadedFileName("x\x1fy")).toBe("xy");
  });

  it("strips bidi override characters from deceptive unicode filenames", () => {
    expect(sanitizeUploadedFileName("invoice\u202Ecod.exe.pdf")).toBe("invoicecod.exe.pdf");
    expect(sanitizeUploadedFileName("a\u2066b.docx")).toBe("ab.docx");
  });

  it("trims and caps at 255", () => {
    expect(sanitizeUploadedFileName("  x  ")).toBe("x");
    const long = "a".repeat(300);
    expect(sanitizeUploadedFileName(long).length).toBe(UPLOADED_FILE_NAME_MAX_LENGTH);
  });

  it("falls back to document when empty after cleaning", () => {
    expect(sanitizeUploadedFileName("   ")).toBe("document");
    expect(sanitizeUploadedFileName("\x00\x01")).toBe("document");
  });
});

describe("validateUploadedFileName", () => {
  it("accepts plain PDF and DOCX upload filenames", () => {
    expect(validateUploadedFileName("agreement.pdf")).toEqual({ ok: true, safeName: "agreement.pdf" });
    expect(validateUploadedFileName("renewal.docx")).toEqual({ ok: true, safeName: "renewal.docx" });
  });

  it("rejects upload filenames with path separators and controls", () => {
    expect(validateUploadedFileName("../../agreement.pdf")).toMatchObject({
      ok: false,
      reason: "path_separator",
      safeName: "agreement.pdf",
    });
    expect(validateUploadedFileName("bad\x00wire.pdf")).toMatchObject({
      ok: false,
      reason: "control_character",
      safeName: "badwire.pdf",
    });
    expect(validateUploadedFileName("invoice\u202Ecod.exe.pdf")).toMatchObject({
      ok: false,
      reason: "control_character",
      safeName: "invoicecod.exe.pdf",
    });
  });

  it("rejects percent-encoded separators and extension-only upload filenames", () => {
    expect(validateUploadedFileName("..%2fagreement.pdf")).toMatchObject({
      ok: false,
      reason: "control_character",
    });
    expect(validateUploadedFileName(".pdf")).toMatchObject({
      ok: false,
      reason: "reserved_name",
    });
  });

  it("rejects disguised executable and archive-like upload filenames", () => {
    expect(validateUploadedFileName("invoice.exe.pdf")).toMatchObject({
      ok: false,
      reason: "banned_extension",
    });
    expect(validateUploadedFileName("contract.pdf.zip")).toMatchObject({
      ok: false,
      reason: "banned_extension",
    });
  });

  it("rejects reserved, empty, and overlong upload filenames", () => {
    expect(validateUploadedFileName("..")).toMatchObject({ ok: false, reason: "reserved_name" });
    expect(validateUploadedFileName("   ")).toMatchObject({ ok: false, reason: "empty" });
    expect(validateUploadedFileName(`${"a".repeat(260)}.pdf`)).toMatchObject({
      ok: false,
      reason: "too_long",
    });
  });
});
