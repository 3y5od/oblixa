import OpenAI from "openai";
import { FIELD_NAMES, type FieldName } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractedFieldResult {
  field_name: FieldName;
  field_value: string | null;
  source_snippet: string | null;
  confidence: number;
}

export interface ExtractFieldsFromTextResult {
  fields: ExtractedFieldResult[];
  /** Shown to the user when extraction completes but yields nothing useful. */
  warning?: string;
}

const FIELD_SET = new Set<string>(FIELD_NAMES);

const SYSTEM_PROMPT = `You are a contract data extraction assistant. You extract specific operational fields from contract text.

Rules:
- Output MUST be one JSON object with a top-level key "fields" whose value is an ARRAY of objects.
- Each object must use "field_name" exactly as given in the schema (snake_case, e.g. end_date, notice_window).
- For each field, provide field_value and source_snippet (verbatim from the document, max ~150 chars) when field_value is non-null.
- If field_value is non-null, source_snippet MUST be non-null with real text from the document (never empty or placeholder).
- If a field is ambiguous or not present, set field_value to null, confidence to 0, and source_snippet to null.
- Dates should be ISO format (YYYY-MM-DD) when possible.
- notice_window: human-readable duration (e.g. "30 days", "60 days before renewal").
- auto_renewal: "yes", "no", or null.
- confidence: number from 0 to 1.
- Include exactly one entry in "fields" for every field_name in the schema list (use null values if unknown).`;

function buildUserPrompt(truncatedText: string): string {
  return `Schema — include one object per field_name below (all ${FIELD_NAMES.length} names must appear in the "fields" array):

${FIELD_NAMES.map((f) => `- ${f}`).join("\n")}

Respond with JSON exactly in this form:
{"fields":[{"field_name":"counterparty","field_value":null,"source_snippet":null,"confidence":0}, ...]}

CONTRACT TEXT:
---
${truncatedText}
---`;
}

function extractArrayFromParsed(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const keys = [
      "fields",
      "extracted_fields",
      "extractedFields",
      "data",
      "results",
      "items",
      "contract_fields",
      "schema_fields",
      "values",
    ];
    for (const k of keys) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
    if (typeof o.field_name === "string") {
      return [parsed];
    }
  }
  return [];
}

function normalizeFieldName(raw: unknown): FieldName | null {
  if (raw == null || typeof raw !== "string") return null;
  let n = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  n = n.replace(/__+/g, "_");
  if (n.startsWith("field_")) n = n.slice(6);
  if (FIELD_SET.has(n)) return n as FieldName;
  return null;
}

function coerceNumber(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const x = parseFloat(v);
    if (!Number.isNaN(x)) return x;
  }
  return 0;
}

function mapRow(row: unknown): ExtractedFieldResult | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const field_name = normalizeFieldName(r.field_name ?? r.name ?? r.key);
  if (!field_name) return null;

  const field_value =
    r.field_value === undefined || r.field_value === null
      ? null
      : String(r.field_value).trim() === ""
        ? null
        : String(r.field_value);

  const source_snippet =
    r.source_snippet === undefined || r.source_snippet === null
      ? null
      : String(r.source_snippet).trim() === ""
        ? null
        : String(r.source_snippet);

  return {
    field_name,
    field_value,
    source_snippet,
    confidence: coerceNumber(r.confidence),
  };
}

/** Keep best row per field_name (highest confidence; prefer non-null value). */
function dedupeByFieldName(rows: ExtractedFieldResult[]): ExtractedFieldResult[] {
  const best = new Map<FieldName, ExtractedFieldResult>();
  for (const f of rows) {
    const cur = best.get(f.field_name);
    if (!cur) {
      best.set(f.field_name, f);
      continue;
    }
    const curScore =
      (cur.field_value ? 2 : 0) + (typeof cur.confidence === "number" ? cur.confidence : 0);
    const fScore =
      (f.field_value ? 2 : 0) + (typeof f.confidence === "number" ? f.confidence : 0);
    if (fScore > curScore) best.set(f.field_name, f);
  }
  return Array.from(best.values());
}

export async function extractFieldsFromText(
  text: string
): Promise<ExtractFieldsFromTextResult> {
  const truncated = text.slice(0, 30000);

  const model =
    process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-4o-mini";

  const response = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(truncated) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    return {
      fields: [],
      warning:
        "The model returned an empty response. Try again, or check your OpenAI account and API key.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("Failed to parse extraction response:", content.slice(0, 500));
    return {
      fields: [],
      warning:
        "Could not parse the model response. Try running extraction again.",
    };
  }

  const rawRows = extractArrayFromParsed(parsed);
  if (rawRows.length === 0) {
    console.error(
      "Extraction JSON had no array of fields. Keys:",
      parsed && typeof parsed === "object"
        ? Object.keys(parsed as object).join(", ")
        : typeof parsed
    );
    return {
      fields: [],
      warning:
        "The model did not return a usable \"fields\" array. Try extraction again, or use a different document export (text PDF or DOCX).",
    };
  }

  const mapped = rawRows
    .map(mapRow)
    .filter((x): x is ExtractedFieldResult => x != null);

  const deduped = dedupeByFieldName(mapped);

  if (deduped.length === 0 && rawRows.length > 0) {
    return {
      fields: [],
      warning:
        "Field names in the model response did not match the expected schema (snake_case names like end_date, notice_window). Try again.",
    };
  }

  const withValues = deduped.filter(
    (f) => f.field_value != null && String(f.field_value).trim().length > 0
  );

  if (deduped.length > 0 && withValues.length === 0) {
    return {
      fields: [],
      warning:
        "No non-empty values were found. The PDF may be scan-only (no text layer), or the agreement may not state these items clearly. Use a text-based PDF or DOCX.",
    };
  }

  return { fields: deduped };
}
