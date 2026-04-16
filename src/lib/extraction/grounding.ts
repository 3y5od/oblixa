export type GroundableField = {
  field_name: string;
  field_value: string | null;
  source_snippet: string | null;
  confidence: number;
};

function normalizeForGrounding(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Drops AI field values whose cited snippet cannot be found in the source document text,
 * reducing hallucinated quotes and values.
 */
export function applyGroundingToFields<T extends GroundableField>(
  combinedText: string,
  fields: T[]
): { fields: T[]; droppedCount: number } {
  const doc = normalizeForGrounding(combinedText);
  let droppedCount = 0;
  const out = fields.map((f) => {
    if (f.field_value == null && f.source_snippet == null) {
      return f;
    }
    const sn = f.source_snippet;
    if (sn == null || !String(sn).trim()) {
      if (f.field_value != null) {
        droppedCount += 1;
        return {
          ...f,
          field_value: null,
          source_snippet: null,
          confidence: 0,
        };
      }
      return f;
    }
    const normSn = normalizeForGrounding(String(sn));
    if (normSn.length < 2) {
      droppedCount += 1;
      return {
        ...f,
        field_value: null,
        source_snippet: null,
        confidence: 0,
      };
    }
    if (!doc.includes(normSn)) {
      droppedCount += 1;
      return {
        ...f,
        field_value: null,
        source_snippet: null,
        confidence: 0,
      };
    }
    return f;
  });
  return { fields: out, droppedCount };
}
