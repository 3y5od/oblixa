import { describe, expect, it } from "vitest";
import { dedupeValidatedUploadedFiles, uploadedFileDuplicateKey } from "@/lib/security/upload-batch";

function fileStub(input: { size: number; type: string }) {
  return input as Pick<File, "size" | "type">;
}

describe("upload batch dedupe", () => {
  it("uses normalized filename, MIME type, and size for duplicate detection", () => {
    expect(uploadedFileDuplicateKey(fileStub({ size: 42, type: "Application/PDF" }), "Agreement.PDF")).toBe(
      uploadedFileDuplicateKey(fileStub({ size: 42, type: "application/pdf" }), "agreement.pdf")
    );
  });

  it("drops duplicate uploaded files before durable upload processing", () => {
    const entries = [
      { file: fileStub({ size: 42, type: "application/pdf" }), validation: { ok: true as const, safeName: "A.pdf" } },
      { file: fileStub({ size: 42, type: "application/pdf" }), validation: { ok: true as const, safeName: "a.pdf" } },
      { file: fileStub({ size: 43, type: "application/pdf" }), validation: { ok: true as const, safeName: "a.pdf" } },
    ];

    const result = dedupeValidatedUploadedFiles(entries);
    expect(result.files).toHaveLength(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.files.map((entry) => entry.file.size)).toEqual([42, 43]);
  });
});
