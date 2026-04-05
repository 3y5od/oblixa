import OpenAI from "openai";
import { FIELD_NAMES } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ExtractedFieldResult {
  field_name: string;
  field_value: string | null;
  source_snippet: string | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a contract data extraction assistant. You extract specific operational fields from contract text.

Rules:
- Only extract the fields listed in the schema below.
- For each field, provide the value and the exact source text snippet where you found it (verbatim from the document, max ~150 chars).
- If a field is ambiguous or not present, set value to null and confidence to 0.
- Dates should be in ISO format (YYYY-MM-DD) when possible.
- notice_window should be a human-readable duration (e.g. "30 days", "60 days before renewal").
- auto_renewal should be "yes", "no", or null.
- confidence is a float from 0 to 1 indicating how certain you are.
- Return ONLY valid JSON.`;

const USER_PROMPT = `Extract these fields from the contract text below:

Fields to extract:
${FIELD_NAMES.map((f) => `- ${f}`).join("\n")}

Return a JSON array of objects with this shape:
{ "field_name": string, "field_value": string | null, "source_snippet": string | null, "confidence": number }

Include ALL fields listed above, even if the value is null.

CONTRACT TEXT:
---
{TEXT}
---`;

export async function extractFieldsFromText(
  text: string
): Promise<ExtractedFieldResult[]> {
  const truncated = text.slice(0, 30000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: USER_PROMPT.replace("{TEXT}", truncated),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    const fields: ExtractedFieldResult[] = Array.isArray(parsed)
      ? parsed
      : parsed.fields || parsed.extracted_fields || [];

    return fields
      .filter(
        (f) =>
          f.field_name &&
          FIELD_NAMES.includes(f.field_name as (typeof FIELD_NAMES)[number])
      )
      .map((f) => ({
        field_name: f.field_name,
        field_value: f.field_value || null,
        source_snippet: f.source_snippet || null,
        confidence: typeof f.confidence === "number" ? f.confidence : 0,
      }));
  } catch {
    console.error("Failed to parse extraction response:", content);
    return [];
  }
}
