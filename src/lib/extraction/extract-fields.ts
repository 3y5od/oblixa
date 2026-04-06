import OpenAI from "openai";
import { FIELD_NAMES, type FieldName } from "@/lib/types";
import { preprocessContractTextForExtraction } from "@/lib/extraction/preprocess-text";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Context sent to the model (larger window for long MSAs). */
export const MAX_EXTRACTION_INPUT_CHARS = 120_000;

export interface ExtractedFieldResult {
  field_name: string;
  field_value: string | null;
  source_snippet: string | null;
  confidence: number;
}

const FIELD_GUIDANCE: Record<FieldName, string> = {
  counterparty: "Other party / client / vendor name (not your org).",
  contract_type: "e.g. MSA, SOW, NDA, lease.",
  effective_date: "When the agreement becomes effective (ISO date if possible).",
  start_date: "Performance or term start (ISO date if possible).",
  end_date: "Expiration or natural end (ISO date if possible).",
  renewal_date: "Next renewal or extension date if stated (ISO if possible).",
  notice_window: "Notice period for termination/non-renewal (e.g. 60 days before end).",
  term: "Length or description of the term (e.g. 12 months, perpetual).",
  fee_reference: "Where fees are described (section, amount, or summary).",
  payment_cadence: "e.g. monthly, annual, milestone, net 30.",
  auto_renewal: 'Whether it auto-renews: "yes", "no", or null if unclear.',
};

const SYSTEM_PROMPT = `You are a contract operations extractor. Your job is to pull a fixed set of operational fields from agreement text so humans can review them.

Rules:
- Use ONLY the field_name values from the user list. Output one object per field in the "fields" array.
- When you find a value, set field_value and source_snippet to a SHORT verbatim quote from the document (max ~150 characters) proving it. Never invent quotes.
- If field_value is non-null, source_snippet MUST be non-null and copied from the document (not a summary).
- If a field is missing, ambiguous, or not in the document, set field_value and source_snippet to null and confidence to 0.
- Dates: prefer ISO YYYY-MM-DD when the document supports it.
- confidence: number from 0 to 1.
- Do not omit any field from the list; return all of them in the array.`;

function buildUserPrompt(contractText: string): string {
  const lines = FIELD_NAMES.map(
    (f) => `- ${f}: ${FIELD_GUIDANCE[f]}`
  ).join("\n");

  return `Extract these fields from the contract text below.

Fields (output one "fields" array element per name, same names):
${lines}

Return JSON with shape: { "fields": [ { "field_name", "field_value", "source_snippet", "confidence" }, ... ] }
Include every field_name listed above exactly once.

CONTRACT TEXT:
---
${contractText}
---`;
}

const FIELD_NAME_ENUM = [...FIELD_NAMES];

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      description:
        "One extraction record per known field; use nulls when the agreement does not state the value.",
      items: {
        type: "object",
        properties: {
          field_name: {
            type: "string",
            enum: FIELD_NAME_ENUM,
          },
          field_value: {
            type: ["string", "null"],
          },
          source_snippet: {
            type: ["string", "null"],
          },
          confidence: { type: "number" },
        },
        required: [
          "field_name",
          "field_value",
          "source_snippet",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["fields"],
  additionalProperties: false,
} as const;

function stripJsonFences(content: string): string {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return s;
}

function coerceFieldArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const keys = [
      "fields",
      "extracted_fields",
      "results",
      "data",
      "extractions",
      "items",
    ] as const;
    for (const k of keys) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function normalizeRows(raw: unknown[]): ExtractedFieldResult[] {
  const out: ExtractedFieldResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = r.field_name;
    if (typeof name !== "string" || !FIELD_NAMES.includes(name as FieldName)) {
      continue;
    }
    const fv = r.field_value;
    const sn = r.source_snippet;
    const conf = r.confidence;
    out.push({
      field_name: name,
      field_value: fv == null ? null : String(fv),
      source_snippet: sn == null ? null : String(sn),
      confidence: typeof conf === "number" && !Number.isNaN(conf) ? conf : 0,
    });
  }
  return out;
}

/** One row per schema field; dedupe by field_name keeping highest confidence. */
export function mergeToAllFieldNames(
  rows: ExtractedFieldResult[]
): ExtractedFieldResult[] {
  const best = new Map<string, ExtractedFieldResult>();
  for (const r of rows) {
    if (!FIELD_NAMES.includes(r.field_name as FieldName)) continue;
    const prev = best.get(r.field_name);
    const c = r.confidence ?? 0;
    if (!prev || c > (prev.confidence ?? 0)) {
      best.set(r.field_name, { ...r });
    }
  }
  return FIELD_NAMES.map((name) => {
    const existing = best.get(name);
    if (existing) return existing;
    return {
      field_name: name,
      field_value: null,
      source_snippet: null,
      confidence: 0,
    };
  });
}

async function callOpenAI(contractText: string): Promise<string | null> {
  const model =
    process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-4o-mini";

  const useSchema = process.env.OPENAI_EXTRACTION_JSON_SCHEMA !== "false";

  const userContent = buildUserPrompt(contractText);

  if (useSchema) {
    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contract_field_extraction",
            description: "Structured contract field extraction.",
            schema: EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
            strict: false,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      return response.choices[0]?.message?.content ?? null;
    } catch (e) {
      console.warn(
        "Structured extraction schema failed, falling back to json_object:",
        e instanceof Error ? e.message : e
      );
    }
  }

  const response = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${userContent}

Respond with a single JSON object: { "fields": [ ... ] } using the same field objects as above.`,
      },
    ],
  });
  return response.choices[0]?.message?.content ?? null;
}

export async function extractFieldsFromText(
  text: string
): Promise<ExtractedFieldResult[]> {
  const prepared = preprocessContractTextForExtraction(text);
  const truncated = prepared.slice(0, MAX_EXTRACTION_INPUT_CHARS);

  const content = await callOpenAI(truncated);
  if (!content) {
    return [];
  }

  try {
    const stripped = stripJsonFences(content);
    const parsed: unknown = JSON.parse(stripped);
    const arr = coerceFieldArray(parsed);
    const rows = normalizeRows(arr);
    if (rows.length === 0) {
      return [];
    }
    return mergeToAllFieldNames(rows);
  } catch {
    console.error("Failed to parse extraction response:", content.slice(0, 2000));
    return [];
  }
}
