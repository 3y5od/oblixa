import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

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

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const raw = await mammoth.extractRawText({ buffer });
    let text = raw.value;
    if (raw.messages?.length) {
      for (const m of raw.messages) {
        if (m.type === "error") {
          console.warn("[mammoth]", m.message);
        }
      }
    }
    const trimmed = text.trim();
    if (trimmed.length < 80) {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const fromHtml = htmlToPlainText(htmlResult.value);
      if (fromHtml.length > trimmed.length) {
        text = fromHtml;
      }
    }
    return text;
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
