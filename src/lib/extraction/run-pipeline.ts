import { createServerClient } from "@supabase/ssr";
import { extractTextFromBuffer } from "@/lib/extraction/parse-document";
import { extractFieldsFromText } from "@/lib/extraction/extract-fields";
import {
  preprocessContractTextForExtraction,
  substantiveTextCharCount,
} from "@/lib/extraction/preprocess-text";
import {
  finishExtractionJob,
} from "@/lib/extraction-job";
import {
  mapAiExtractionError,
  mapExtractionFailureMessage,
} from "@/lib/extraction/user-messages";
import * as Sentry from "@sentry/nextjs";

function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * Runs the full extraction pipeline (storage → text → OpenAI → DB).
 * Called from Route Handler `after()` — uses a fresh service-role client.
 */
export async function runExtractionPipeline(params: {
  contractId: string;
  userId: string;
  organizationId: string;
}): Promise<void> {
  const { contractId, userId, organizationId } = params;
  const admin = createServiceRoleClient();
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

    const textChunks = await Promise.all(
      files.map(async (file) => {
        try {
          const { data: fileData, error } = await admin.storage
            .from("contracts")
            .download(file.storage_path);

          if (error || !fileData) {
            console.error(`Download failed for ${file.file_name}:`, error?.message);
            return "";
          }

          const buffer = Buffer.from(await fileData.arrayBuffer());
          const text = await extractTextFromBuffer(buffer, file.file_type);
          return `\n--- ${file.file_name} ---\n${text}\n`;
        } catch (err) {
          console.error(`Parse failed for ${file.file_name}:`, err);
          return "";
        }
      })
    );

    const combinedText = preprocessContractTextForExtraction(
      textChunks.join("")
    );

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

    const textChars = substantiveTextCharCount(combinedText);
    if (textChars < 200) {
      await fail(
        "Very little text was extracted from the file(s). Scanned PDFs (images only) are not supported—use a text-based PDF or DOCX, or run OCR first."
      );
      console.info(
        JSON.stringify({
          event: "extraction.failed",
          contractId,
          userId,
          durationMs: Date.now() - pipelineStartedAt,
          reason: "too_little_text",
        })
      );
      return;
    }

    const searchCap = 120_000;
    await admin
      .from("contracts")
      .update({ search_document: combinedText.slice(0, searchCap) })
      .eq("id", contractId);

    let fields: Awaited<ReturnType<typeof extractFieldsFromText>>;
    try {
      fields = await extractFieldsFromText(combinedText);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "AI extraction request failed";
      console.error("OpenAI extraction error:", err);
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, { extra: { contractId, rawMessage: raw } });
      }
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

    if (fields.length === 0) {
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

    let inserted = 0;
    const { data: existing } = await admin
      .from("extracted_fields")
      .select("field_name")
      .eq("contract_id", contractId);

    const existingNames = new Set((existing ?? []).map((e) => e.field_name));

    const newFields = fields
      .filter((f) => !existingNames.has(f.field_name))
      .map((f) => ({
        contract_id: contractId,
        field_name: f.field_name,
        field_value: f.field_value,
        source_snippet: f.source_snippet,
        confidence: f.confidence,
        source: "ai" as const,
        status: "pending" as const,
      }));

    if (newFields.length > 0) {
      const { error: insertFieldsError } = await admin
        .from("extracted_fields")
        .insert(newFields);
      if (insertFieldsError) {
        console.error("extracted_fields insert:", insertFieldsError.message);
        if (process.env.SENTRY_DSN) {
          Sentry.captureMessage(insertFieldsError.message, {
            level: "error",
            extra: { contractId, code: insertFieldsError.code },
          });
        }
        await fail(insertFieldsError.message);
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
      inserted = newFields.length;
    }

    await admin.from("audit_events").insert({
      organization_id: organizationId,
      contract_id: contractId,
      user_id: userId,
      action: "extraction.completed",
      details: {
        fields_returned: fields.length,
        fields_inserted: inserted,
        text_chars: textChars,
      },
    });

    await finishExtractionJob(admin, contractId, true);

    console.info(
      JSON.stringify({
        event: "extraction.completed",
        contractId,
        userId,
        durationMs: Date.now() - pipelineStartedAt,
        fieldsReturned: fields.length,
        fieldsInserted: inserted,
        textChars,
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
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { contractId } });
    }
    const safe = mapExtractionFailureMessage(raw);
    await finishExtractionJob(admin, contractId, false, safe);
  }
}
