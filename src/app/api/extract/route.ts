import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { extractTextFromBuffer } from "@/lib/extraction/parse-document";
import { extractFieldsFromText } from "@/lib/extraction/extract-fields";
import {
  preprocessContractTextForExtraction,
  substantiveTextCharCount,
} from "@/lib/extraction/preprocess-text";
import { canEditContracts, getOrgMemberRole } from "@/lib/permissions";
import { isPlanEnforcementEnabled, orgHasActivePlan } from "@/lib/plan";
import {
  finishExtractionJob,
  startExtractionJob,
} from "@/lib/extraction-job";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  const { contractId } = (await request.json()) as { contractId: string };

  if (!contractId) {
    return NextResponse.json({ error: "contractId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: contract } = await admin
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", contract.organization_id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const role = await getOrgMemberRole(admin, user.id, contract.organization_id);
  if (!canEditContracts(role)) {
    return NextResponse.json({ error: "Viewers cannot run extraction" }, { status: 403 });
  }
  if (
    isPlanEnforcementEnabled() &&
    !(await orgHasActivePlan(admin, contract.organization_id))
  ) {
    return NextResponse.json(
      { error: "An active subscription is required" },
      { status: 402 }
    );
  }

  const jobStart = await startExtractionJob(
    admin,
    contractId,
    contract.organization_id
  );
  if (!jobStart.ok) {
    return NextResponse.json(
      { error: jobStart.error },
      { status: jobStart.status }
    );
  }

  const fail = async (message: string, httpStatus: number) => {
    await finishExtractionJob(admin, contractId, false, message);
    return NextResponse.json({ error: message }, { status: httpStatus });
  };

  try {
    const { data: filesRaw } = await admin
      .from("contract_files")
      .select("*")
      .eq("contract_id", contractId);

    const files = [...(filesRaw ?? [])].sort((a, b) =>
      (a.file_name || "").localeCompare(b.file_name || "")
    );

    if (!files.length) {
      return await fail("No files found", 404);
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
      return await fail("Could not extract text from any files", 422);
    }

    const textChars = substantiveTextCharCount(combinedText);
    if (textChars < 200) {
      return await fail(
        "Very little text was extracted from the file(s). Scanned PDFs (images only) are not supported—use a text-based PDF or DOCX, or run OCR first.",
        422
      );
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
      const msg =
        err instanceof Error ? err.message : "AI extraction request failed";
      console.error("OpenAI extraction error:", err);
      return await fail(msg, 502);
    }

    if (fields.length === 0) {
      return await fail(
        "Extraction did not return usable fields. Verify OPENAI_API_KEY, model access, and try again (see server logs).",
        422
      );
    }

    let inserted = 0;
    if (fields.length > 0) {
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
        await admin.from("extracted_fields").insert(newFields);
        inserted = newFields.length;
      }
    }

    await admin.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contractId,
      user_id: user.id,
      action: "extraction.completed",
      details: {
        fields_returned: fields.length,
        fields_inserted: inserted,
        text_chars: textChars,
      },
    });

    await finishExtractionJob(admin, contractId, true);

    return NextResponse.json({
      extracted: fields.length,
      inserted,
      textChars,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction failed";
    console.error("Extraction pipeline error:", err);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { extra: { contractId } });
    }
    await finishExtractionJob(admin, contractId, false, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
