import { extractTextFromBuffer } from "@/lib/extraction/parse-document";
import { extractFieldsFromText } from "@/lib/extraction/extract-fields";
import {
  preprocessContractTextForExtraction,
  substantiveTextCharCount,
} from "@/lib/extraction/preprocess-text";
import { finishExtractionJob } from "@/lib/extraction-job";
import {
  mapAiExtractionError,
  mapExtractionFailureMessage,
} from "@/lib/extraction/user-messages";
import { applyGroundingToFields } from "@/lib/extraction/grounding";
import { extractTextFromPdfViaOpenAi } from "@/lib/extraction/openai-pdf-text";
import { EXTRACTION_SEARCH_DOCUMENT_CAP } from "@/lib/extraction/constants";
import { mapWithConcurrency } from "@/lib/extraction/concurrency";
import { withRetry } from "@/lib/extraction/retry";
import { createAdminClient } from "@/lib/supabase/server";
import {
  captureServerException,
  captureServerMessage,
} from "@/lib/observability/sentry";

type Admin = Awaited<ReturnType<typeof createAdminClient>>;
const FILE_PARSE_CONCURRENCY = 4;
const FIELD_WRITE_BATCH_SIZE = 200;

function isRetryableStorageError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found|404|does not exist|no such object/i.test(msg)) {
    return false;
  }
  return true;
}

async function downloadContractFile(admin: Admin, storagePath: string) {
  return withRetry(
    async () => {
      const { data, error } = await admin.storage
        .from("contracts")
        .download(storagePath);
      if (error || !data) {
        throw new Error(error?.message ?? "storage download failed");
      }
      return data;
    },
    {
      maxAttempts: 4,
      baseDelayMs: 400,
      shouldRetry: isRetryableStorageError,
    }
  );
}

function shouldAllowAiOverwrite(status: string, source: string): boolean {
  if (source === "human") return false;
  if (status === "approved" || status === "edited") return false;
  return true;
}

/**
 * Runs the full extraction pipeline (storage → text → OpenAI → DB).
 * Called from Route Handler `after()` or `/api/extract/run` — uses service role.
 */
export async function runExtractionPipeline(params: {
  admin?: Admin;
  contractId: string;
  userId: string;
  organizationId: string;
}): Promise<void> {
  const { contractId, userId, organizationId } = params;
  const admin = params.admin ?? (await createAdminClient());
  const pipelineStartedAt = Date.now();

  const fail = async (message: string) => {
    const safe = mapExtractionFailureMessage(message);
    await finishExtractionJob(admin, contractId, false, safe);
  };

  try {
    const { data: filesRaw } = await admin
      .from("contract_files")
      .select("file_name, file_type, storage_path")
      .eq("contract_id", contractId);

    const files = [...(filesRaw ?? [])].sort((a, b) =>
      (a.file_name || "").localeCompare(b.file_name || "")
    );

    if (!files.length) {
      await fail("No files found");
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "no_files",
        })
      );
      return;
    }

    const textChunks = await mapWithConcurrency(files, FILE_PARSE_CONCURRENCY, async (file) => {
        try {
          let fileData: Blob;
          try {
            fileData = await downloadContractFile(admin, file.storage_path);
          } catch (e) {
            console.error(`Download failed for ${file.file_name}:`, e);
            return {
              marker: file.file_name,
              text: "",
              mime: file.file_type,
              buffer: undefined as Buffer | undefined,
            };
          }

          const buffer = Buffer.from(await fileData.arrayBuffer());
          const text = await extractTextFromBuffer(buffer, file.file_type);
          return {
            marker: file.file_name,
            text,
            mime: file.file_type,
            buffer: file.file_type === "application/pdf" ? buffer : undefined,
          };
        } catch (err) {
          console.error(`Parse failed for ${file.file_name}:`, err);
          return {
            marker: file.file_name,
            text: "",
            mime: file.file_type,
            buffer: undefined as Buffer | undefined,
          };
        }
      });

    let combinedText = preprocessContractTextForExtraction(
      textChunks.map((c) => `\n--- ${c.marker} ---\n${c.text}\n`).join("")
    );

    let textChars = substantiveTextCharCount(combinedText);
    let pdfOcrUsed = false;

    if (textChars < 200) {
      for (const part of textChunks) {
        if (part.mime !== "application/pdf" || !part.buffer) {
          continue;
        }
        const ocr = await extractTextFromPdfViaOpenAi(part.buffer, part.marker);
        if (ocr?.text) {
          pdfOcrUsed = true;
          combinedText = preprocessContractTextForExtraction(
            `${combinedText}\n\n--- ${part.marker} (ocr) ---\n${ocr.text}\n`
          );
          textChars = substantiveTextCharCount(combinedText);
          if (textChars >= 200) {
            break;
          }
        }
      }
    }

    if (!combinedText.trim()) {
      await fail("Could not extract text from any files");
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "no_text",
        })
      );
      return;
    }

    if (textChars < 200) {
      await fail(
        "Very little text was extracted from the file(s). Scanned PDFs may require OCR—try a text-based PDF or DOCX, or ensure OPENAI_API_KEY is set for PDF-assisted text recovery."
      );
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "too_little_text",
          pdfOcrUsed,
        })
      );
      return;
    }

    await admin
      .from("contracts")
      .update({
        search_document: combinedText.slice(0, EXTRACTION_SEARCH_DOCUMENT_CAP),
      })
      .eq("id", contractId);

    let extraction: Awaited<ReturnType<typeof extractFieldsFromText>>;
    try {
      extraction = await extractFieldsFromText(combinedText);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "AI extraction request failed";
      console.error("OpenAI extraction error:", err);
      captureServerException(err, { extra: { contractId, rawMessage: raw } });
      const friendly = mapAiExtractionError(raw);
      await finishExtractionJob(admin, contractId, false, friendly);
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "openai",
        })
      );
      return;
    }

    if (extraction.fields.length === 0) {
      await fail(
        "Extraction did not return usable fields. Verify OPENAI_API_KEY, model access, and try again (see server logs)."
      );
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "no_fields",
        })
      );
      return;
    }

    const { fields: grounded, droppedCount: groundingDropped } =
      applyGroundingToFields(combinedText, extraction.fields);

    const { data: existingRows } = await admin
      .from("extracted_fields")
      .select("id, field_name, source, status")
      .eq("contract_id", contractId);

    const byFieldName = new Map(
      (existingRows ?? []).map((r) => [r.field_name, r])
    );

    let inserted = 0;
    let updated = 0;
    let skippedProtected = 0;
    const pendingInserts: Array<{
      contract_id: string;
      field_name: string;
      field_value: string | null;
      source_snippet: string | null;
      confidence: number | null;
      source: "ai";
      status: "pending";
    }> = [];
    const pendingUpdates: Array<{
      id: string;
      field_value: string | null;
      source_snippet: string | null;
      confidence: number | null;
      source: "ai";
      status: "pending";
      reviewed_by: null;
      reviewed_at: null;
    }> = [];

    for (const f of grounded) {
      const row = {
        field_value: f.field_value,
        source_snippet: f.source_snippet,
        confidence: f.confidence,
        source: "ai" as const,
        status: "pending" as const,
      };

      const prev = byFieldName.get(f.field_name);
      if (!prev) {
        pendingInserts.push({
          contract_id: contractId,
          field_name: f.field_name,
          ...row,
        });
        continue;
      }

      if (!shouldAllowAiOverwrite(prev.status, prev.source)) {
        skippedProtected += 1;
        continue;
      }

      pendingUpdates.push({
        id: prev.id,
        ...row,
        reviewed_by: null,
        reviewed_at: null,
      });
    }

    for (let i = 0; i < pendingInserts.length; i += FIELD_WRITE_BATCH_SIZE) {
      const chunk = pendingInserts.slice(i, i + FIELD_WRITE_BATCH_SIZE);
      const { error: insertErr } = await admin.from("extracted_fields").insert(chunk);
      if (insertErr) {
        console.error("extracted_fields insert:", insertErr.message);
        captureServerMessage(insertErr.message, {
          level: "error",
          extra: { contractId, code: insertErr.code },
        });
        await fail(insertErr.message);
        console.info(
          JSON.stringify({
            event: "extraction.failed",
            contractId,
            userId,
            durationMs: Date.now() - pipelineStartedAt,
            reason: "insert_fields",
          })
        );
        return;
      }
      inserted += chunk.length;
    }

    for (let i = 0; i < pendingUpdates.length; i += FIELD_WRITE_BATCH_SIZE) {
      const chunk = pendingUpdates.slice(i, i + FIELD_WRITE_BATCH_SIZE);
      const { error: updErr } = await admin
        .from("extracted_fields")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });
      if (updErr) {
        console.error("extracted_fields update:", updErr.message);
        captureServerMessage(updErr.message, {
          level: "error",
          extra: { contractId, code: updErr.code },
        });
        await fail(updErr.message);
        return;
      }
      updated += chunk.length;
    }

    await admin.from("audit_events").insert({
      organization_id: organizationId,
      contract_id: contractId,
      user_id: userId,
      action: "extraction.completed",
      details: {
        fields_returned: extraction.fields.length,
        fields_inserted: inserted,
        fields_updated: updated,
        fields_skipped_protected: skippedProtected,
        text_chars: textChars,
        chunk_count: extraction.chunkCount,
        prompt_tokens: extraction.usage.promptTokens,
        completion_tokens: extraction.usage.completionTokens,
        total_tokens: extraction.usage.totalTokens,
        grounding_dropped: groundingDropped,
        pdf_ocr_used: pdfOcrUsed,
      },
    });

    await finishExtractionJob(admin, contractId, true);

    console.info(
      JSON.stringify({
        event: "extraction.completed",
        contractId,
        userId,
        durationMs: Date.now() - pipelineStartedAt,
        fieldsReturned: extraction.fields.length,
        fieldsInserted: inserted,
        fieldsUpdated: updated,
        textChars,
        chunkCount: extraction.chunkCount,
        promptTokens: extraction.usage.promptTokens,
        completionTokens: extraction.usage.completionTokens,
        totalTokens: extraction.usage.totalTokens,
        groundingDropped,
        pdfOcrUsed,
      })
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Extraction failed";
    console.error("Extraction pipeline error:", err);
    console.info(
      JSON.stringify({
        event: "extraction.failed",
        contractId,
        userId,
        durationMs: Date.now() - pipelineStartedAt,
        message: raw,
      })
    );
    captureServerException(err, { extra: { contractId } });
    const safe = mapExtractionFailureMessage(raw);
    await finishExtractionJob(admin, contractId, false, safe);
  }
}
