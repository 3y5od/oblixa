/**
 * Strip path components and control characters from client-provided file names
 * before using in storage keys or DB display fields.
 */
export function sanitizeUploadedFileName(name: string): string {
  let base = name.split(/[/\\]/).pop() ?? "document";
  if (base === ".." || base === ".") base = "document";
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").trim();
  const trimmed = cleaned.slice(0, 255);
  return trimmed.length > 0 ? trimmed : "document";
}
