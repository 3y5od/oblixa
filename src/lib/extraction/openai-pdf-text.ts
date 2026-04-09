import { isRetryableOpenAIError, withRetry } from "@/lib/extraction/retry";

type OpenAIClient = InstanceType<Awaited<typeof import("openai")>["default"]>;

let openAiModulePromise: Promise<{
  client: OpenAIClient;
  toFile: (typeof import("openai"))["toFile"];
}> | null = null;

async function getOpenAiForPdf() {
  if (!openAiModulePromise) {
    openAiModulePromise = import("openai").then((m) => ({
      client: new m.default({ apiKey: process.env.OPENAI_API_KEY }),
      toFile: m.toFile,
    }));
  }
  return openAiModulePromise;
}

/**
 * When pdf-parse yields almost no text (scanned PDF), ask OpenAI to read the PDF bytes.
 * Uses the Files API + chat completions with a file attachment.
 */
export async function extractTextFromPdfViaOpenAi(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; model: string } | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return null;
  }

  const primary =
    process.env.OPENAI_PDF_OCR_MODEL?.trim() || "gpt-4o-mini";
  const fallback = process.env.OPENAI_PDF_OCR_FALLBACK_MODEL?.trim() || "gpt-4o";

  const run = async (model: string): Promise<string> => {
    return withRetry(
      async () => {
        const { client, toFile } = await getOpenAiForPdf();
        const upload = await client.files.create({
          file: await toFile(buffer, fileName || "document.pdf", {
            type: "application/pdf",
          }),
          purpose: "user_data",
        });
        try {
          const response = await client.chat.completions.create({
            model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content:
                  "You extract plain text from PDF documents. Output only the document text, preserving paragraph breaks. Use a blank line between sections. Do not summarize or add commentary.",
              },
              {
                role: "user",
                content: [
                  { type: "file", file: { file_id: upload.id } },
                  {
                    type: "text",
                    text: "Extract all readable text from this PDF. Output plain text only.",
                  },
                ],
              },
            ],
          });
          return response.choices[0]?.message?.content?.trim() ?? "";
        } finally {
          await client.files.delete(upload.id).catch(() => {});
        }
      },
      { maxAttempts: 3, baseDelayMs: 600, shouldRetry: isRetryableOpenAIError }
    );
  };

  try {
    const text = await run(primary);
    if (text.length > 0) {
      return { text, model: primary };
    }
  } catch (e) {
    console.warn(
      "[openai-pdf-text] primary model failed:",
      e instanceof Error ? e.message : e
    );
  }

  if (fallback === primary) {
    return null;
  }

  try {
    const text = await run(fallback);
    if (text.length > 0) {
      return { text, model: fallback };
    }
  } catch (e) {
    console.error(
      "[openai-pdf-text] fallback failed:",
      e instanceof Error ? e.message : e
    );
  }

  return null;
}
