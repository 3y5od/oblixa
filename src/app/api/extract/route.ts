import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromBuffer } from "@/lib/extraction/parse-document";
import { extractFieldsFromText } from "@/lib/extraction/extract-fields";

export async function POST(request: Request) {
  const { contractId } = (await request.json()) as { contractId: string };

  if (!contractId) {
    return NextResponse.json({ error: "contractId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: files } = await supabase
    .from("contract_files")
    .select("*")
    .eq("contract_id", contractId);

  if (!files?.length) {
    return NextResponse.json({ error: "No files found" }, { status: 404 });
  }

  let combinedText = "";

  for (const file of files) {
    try {
      const { data: fileData, error } = await supabase.storage
        .from("contracts")
        .download(file.storage_path);

      if (error || !fileData) {
        console.error(`Download failed for ${file.file_name}:`, error?.message);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const text = await extractTextFromBuffer(buffer, file.file_type);
      combinedText += `\n--- ${file.file_name} ---\n${text}\n`;
    } catch (err) {
      console.error(`Parse failed for ${file.file_name}:`, err);
    }
  }

  if (!combinedText.trim()) {
    return NextResponse.json(
      { error: "Could not extract text from any files" },
      { status: 422 }
    );
  }

  const fields = await extractFieldsFromText(combinedText);

  if (fields.length > 0) {
    const { data: existing } = await supabase
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
      await supabase.from("extracted_fields").insert(newFields);
    }
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("organization_id")
    .eq("id", contractId)
    .single();

  if (contract) {
    await supabase.from("audit_events").insert({
      organization_id: contract.organization_id,
      contract_id: contractId,
      user_id: user.id,
      action: "extraction.completed",
      details: { fields_extracted: fields.length },
    });
  }

  return NextResponse.json({ extracted: fields.length });
}
