/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_PARSER_MAX_BUFFER_BYTES,
  DOCUMENT_PARSER_MAX_DOCX_ENTRIES,
  DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO,
  DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES,
  DOCUMENT_PARSER_MAX_EXTRACTED_TEXT_CHARS,
  DOCUMENT_PARSER_MAX_PDF_PAGES,
  assertDocxZipExpansionWithinParserLimits,
  assertPdfParserBounds,
  extractTextFromBuffer,
  inspectDocxZipExpansion,
} from "@/lib/extraction/parse-document";

function makeDocxCentralDirectory(input: {
  entryCount?: number;
  compressedBytes?: number;
  uncompressedBytes?: number;
  entryNames?: string[];
}): Buffer {
  const entryNames = input.entryNames ?? ["[Content_Types].xml", "word/document.xml"];
  const entryCount = input.entryCount ?? entryNames.length;
  const entries: Buffer[] = [];
  for (let i = 0; i < entryCount; i++) {
    const fileName = Buffer.from(entryNames[i % entryNames.length], "utf8");
    const entry = Buffer.alloc(46 + fileName.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt32LE(input.compressedBytes ?? 1, 20);
    entry.writeUInt32LE(input.uncompressedBytes ?? 1, 24);
    entry.writeUInt16LE(fileName.length, 28);
    fileName.copy(entry, 46);
    entries.push(entry);
  }

  const centralDirectory = Buffer.concat(entries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([centralDirectory, eocd]);
}

describe("DOCX / PDF parse boundaries (corrupt input)", () => {
  it("mammoth rejects truncated docx buffer with a controlled error", async () => {
    const mammoth = await import("mammoth");
    const buf = Buffer.from("PK\x03\x04not-a-real-docx", "utf8");
    await expect(mammoth.extractRawText({ buffer: buf })).rejects.toThrow();
  });

  it("rejects malformed docx through the bounded parser wrapper", async () => {
    const buf = Buffer.from("PK\x03\x04not-a-real-docx", "utf8");
    await expect(
      extractTextFromBuffer(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).rejects.toThrow("Document parser DOCX central directory missing");
  });

  it("rejects malformed pdf through the bounded parser wrapper", async () => {
    const buf = Buffer.from("%PDF-1.7\nnot-a-real-pdf\n%%EOF", "utf8");
    await expect(extractTextFromBuffer(buf, "application/pdf")).rejects.toThrow();
  });

  it("rejects parser buffers larger than the upload ceiling", async () => {
    const buf = Buffer.alloc(DOCUMENT_PARSER_MAX_BUFFER_BYTES + 1);
    await expect(extractTextFromBuffer(buf, "application/pdf")).rejects.toThrow("Document parser input too large");
  });

  it("rejects PDF page counts above the parser ceiling", () => {
    expect(() =>
      assertPdfParserBounds({ text: "ok", numpages: DOCUMENT_PARSER_MAX_PDF_PAGES + 1 })
    ).toThrow("Document parser PDF page count too large");
  });

  it("rejects extracted parser text above the extraction ceiling", () => {
    expect(() =>
      assertPdfParserBounds({ text: "x".repeat(DOCUMENT_PARSER_MAX_EXTRACTED_TEXT_CHARS + 1), numpages: 1 })
    ).toThrow("Document parser extracted text too large");
  });

  it("rejects docx zip expansion before mammoth parsing", async () => {
    const buf = makeDocxCentralDirectory({
      compressedBytes: 1,
      uncompressedBytes: DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES + 1,
    });

    expect(inspectDocxZipExpansion(buf)).toMatchObject({
      entryCount: 2,
      compressedBytes: 2,
      uncompressedBytes: (DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES + 1) * 2,
    });
    await expect(
      extractTextFromBuffer(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).rejects.toThrow("Document parser DOCX archive expands too large");
  });

  it("rejects docx archive entries with unsafe internal names", () => {
    const buf = makeDocxCentralDirectory({
      entryNames: ["[Content_Types].xml", "../word/document.xml"],
    });

    expect(() => inspectDocxZipExpansion(buf)).toThrow("Document parser DOCX entry name unsafe");
  });

  it("rejects docx archives with suspicious compression ratios", () => {
    const buf = makeDocxCentralDirectory({
      compressedBytes: 1,
      uncompressedBytes: DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO + 1,
    });

    expect(() => assertDocxZipExpansionWithinParserLimits(buf)).toThrow(
      "Document parser DOCX archive compression ratio too high"
    );
  });

  it("rejects docx archives missing required document entries", () => {
    const buf = makeDocxCentralDirectory({
      entryNames: ["[Content_Types].xml", "docProps/core.xml"],
    });

    expect(() => assertDocxZipExpansionWithinParserLimits(buf)).toThrow(
      "Document parser DOCX required entries missing"
    );
  });

  it("rejects docx archives with too many central directory entries", async () => {
    const buf = makeDocxCentralDirectory({ entryCount: DOCUMENT_PARSER_MAX_DOCX_ENTRIES + 1 });

    await expect(
      extractTextFromBuffer(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).rejects.toThrow("Document parser DOCX archive has too many entries");
  });
});
