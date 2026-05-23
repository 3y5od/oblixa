import { EXTRACTION_MAX_TEXT_CHARS } from "@/lib/extraction/constants";

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|tr|li|br)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const DOCUMENT_PARSER_TIMEOUT_MS = 15_000;
export const DOCUMENT_PARSER_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_PARSER_MAX_PDF_PAGES = 250;
export const DOCUMENT_PARSER_MAX_EXTRACTED_TEXT_CHARS = EXTRACTION_MAX_TEXT_CHARS;
export const DOCUMENT_PARSER_MAX_DOCX_ENTRIES = 2_000;
export const DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
export const DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO = 100;
export const DOCUMENT_PARSER_MAX_HTML_CHARS = EXTRACTION_MAX_TEXT_CHARS * 2;

type PdfParserResult = {
  text?: string;
  numpages?: number;
};

export type DocxZipExpansionStats = {
  entryCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  maxCompressionRatio: number;
  hasContentTypes: boolean;
  hasDocumentXml: boolean;
};

async function withParserTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Document parser timed out")), DOCUMENT_PARSER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function assertExtractedTextWithinParserLimit(text: string): string {
  if (text.length > DOCUMENT_PARSER_MAX_EXTRACTED_TEXT_CHARS) {
    throw new Error("Document parser extracted text too large");
  }
  return text;
}

export function assertPdfParserBounds(result: PdfParserResult): string {
  if (typeof result.numpages === "number" && result.numpages > DOCUMENT_PARSER_MAX_PDF_PAGES) {
    throw new Error("Document parser PDF page count too large");
  }
  return assertExtractedTextWithinParserLimit(result.text ?? "");
}

function assertHtmlFallbackWithinParserLimit(html: string): string {
  if (html.length > DOCUMENT_PARSER_MAX_HTML_CHARS) {
    throw new Error("Document parser HTML fallback output too large");
  }
  return html;
}

function isDocxZipEntryNameSafe(name: string): boolean {
  if (!name || name.length > 512) return false;
  if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[a-z]:/i.test(name)) return false;
  return !name.split("/").some((part) => part === ".." || part === "");
}

export function inspectDocxZipExpansion(buffer: Buffer): DocxZipExpansionStats | null {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const searchWindow = Math.min(buffer.length, 0xffff + 22);
  const searchStart = buffer.length - searchWindow;
  const eocdRelativeIndex = buffer.subarray(searchStart).lastIndexOf(eocdSignature);
  if (eocdRelativeIndex < 0) return null;

  const eocdIndex = searchStart + eocdRelativeIndex;
  if (eocdIndex + 22 > buffer.length) {
    throw new Error("Document parser DOCX central directory invalid");
  }

  const entryCount = buffer.readUInt16LE(eocdIndex + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdIndex + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdIndex + 16);
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error("Document parser DOCX ZIP64 metadata is not supported");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("Document parser DOCX central directory invalid");
  }

  let cursor = centralDirectoryOffset;
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  let maxCompressionRatio = 0;
  let hasContentTypes = false;
  let hasDocumentXml = false;
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Document parser DOCX central directory invalid");
    }
    const entryCompressedBytes = buffer.readUInt32LE(cursor + 20);
    const entryUncompressedBytes = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) {
      throw new Error("Document parser DOCX central directory invalid");
    }
    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString("utf8");
    if (!isDocxZipEntryNameSafe(fileName)) {
      throw new Error("Document parser DOCX entry name unsafe");
    }
    const normalizedName = fileName.toLowerCase();
    if (normalizedName === "[content_types].xml") hasContentTypes = true;
    if (normalizedName === "word/document.xml") hasDocumentXml = true;
    compressedBytes += entryCompressedBytes;
    uncompressedBytes += entryUncompressedBytes;
    const ratio =
      entryCompressedBytes > 0
        ? entryUncompressedBytes / entryCompressedBytes
        : entryUncompressedBytes > 0
          ? Number.POSITIVE_INFINITY
          : 0;
    maxCompressionRatio = Math.max(maxCompressionRatio, ratio);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error("Document parser DOCX central directory invalid");
  }

  return {
    entryCount,
    compressedBytes,
    uncompressedBytes,
    maxCompressionRatio,
    hasContentTypes,
    hasDocumentXml,
  };
}

export function assertDocxZipExpansionWithinParserLimits(buffer: Buffer): void {
  const stats = inspectDocxZipExpansion(buffer);
  if (!stats) {
    throw new Error("Document parser DOCX central directory missing");
  }
  if (stats.entryCount > DOCUMENT_PARSER_MAX_DOCX_ENTRIES) {
    throw new Error("Document parser DOCX archive has too many entries");
  }
  if (stats.uncompressedBytes > DOCUMENT_PARSER_MAX_DOCX_UNCOMPRESSED_BYTES) {
    throw new Error("Document parser DOCX archive expands too large");
  }
  if (stats.maxCompressionRatio > DOCUMENT_PARSER_MAX_DOCX_EXPANSION_RATIO) {
    throw new Error("Document parser DOCX archive compression ratio too high");
  }
  if (!stats.hasContentTypes || !stats.hasDocumentXml) {
    throw new Error("Document parser DOCX required entries missing");
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (buffer.length > DOCUMENT_PARSER_MAX_BUFFER_BYTES) {
    throw new Error("Document parser input too large");
  }
  if (mimeType === "application/pdf") {
    // pdf-parse 1.x: pure JS text extraction for Node/serverless. v2.x pulls in
    // pdfjs-dist + @napi-rs/canvas and breaks on Vercel (DOMMatrix / native canvas).
    // Dynamic import keeps mammoth off the module graph for PDF-only work (and vice versa).
    const pdfParse = (await import("pdf-parse")).default;
    const result = await withParserTimeout(pdfParse(buffer));
    return assertPdfParserBounds(result);
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    assertDocxZipExpansionWithinParserLimits(buffer);
    const mammoth = (await import("mammoth")).default;
    const raw = await withParserTimeout(mammoth.extractRawText({ buffer }));
    let text = assertExtractedTextWithinParserLimit(raw.value);
    if (raw.messages?.length) {
      for (const m of raw.messages) {
        if (m.type === "error") {
          console.warn("[mammoth]", m.message);
        }
      }
    }
    const trimmed = text.trim();
    if (trimmed.length < 80) {
      const htmlResult = await withParserTimeout(mammoth.convertToHtml({ buffer }));
      const fromHtml = assertExtractedTextWithinParserLimit(
        htmlToPlainText(assertHtmlFallbackWithinParserLimit(htmlResult.value))
      );
      if (fromHtml.length > trimmed.length) {
        text = fromHtml;
      }
    }
    return assertExtractedTextWithinParserLimit(text);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
