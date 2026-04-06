import pdfParse from "pdf-parse";
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
    // pdf-parse 1.x: pure JS text extraction for Node/serverless. v2.x pulls in
    // pdfjs-dist + @napi-rs/canvas and breaks on Vercel (DOMMatrix / native canvas).
    const result = await pdfParse(buffer);
    return result.text ?? "";
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
