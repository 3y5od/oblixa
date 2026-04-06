/**
 * Map upstream / internal errors to safe, user-facing copy (no API keys, stack traces).
 */
export function mapAiExtractionError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return "The AI service is busy. Wait a minute and try again.";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset")
  ) {
    return "The request timed out. Try again, or use smaller or fewer files.";
  }
  if (
    lower.includes("401") ||
    lower.includes("invalid api key") ||
    lower.includes("incorrect api key") ||
    lower.includes("invalid_api_key")
  ) {
    return "AI extraction is not configured correctly. Contact support.";
  }
  if (
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("exceeded your current quota")
  ) {
    return "AI quota or billing limits were hit. Contact your administrator.";
  }
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist"))) {
    return "The configured AI model is unavailable. Contact support.";
  }
  return "AI extraction failed. Please try again in a moment.";
}

function looksLikeTechnicalErrorDump(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (lower.includes("node_modules") || lower.includes("typeerror") || lower.includes("referenceerror")) {
    return true;
  }
  if (raw.includes("    at ") || raw.includes("\n    at ")) {
    return true;
  }
  return raw.length > 400 && (lower.includes(" at ") || lower.includes("stack"));
}

/** Best-effort friendly message for DB or pipeline strings that might leak internals. */
export function mapExtractionFailureMessage(raw: string): string {
  const mapped = mapAiExtractionError(raw);
  if (mapped !== "AI extraction failed. Please try again in a moment.") {
    return mapped;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "Could not save extracted fields. Refresh the page and try again.";
  }
  if (lower.includes("violates foreign key") || lower.includes("foreign key constraint")) {
    return "This contract could not be updated. Refresh and try again.";
  }
  if (looksLikeTechnicalErrorDump(raw)) {
    return "Extraction failed. Please try again or contact support if it persists.";
  }
  return raw;
}
