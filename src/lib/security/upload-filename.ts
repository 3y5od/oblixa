/**
 * Strip path components and control characters from client-provided file names
 * before using in storage keys or DB display fields.
 */
export const UPLOADED_FILE_NAME_MAX_LENGTH = 255;

export type UploadedFileNameValidationFailure =
  | "empty"
  | "path_separator"
  | "control_character"
  | "reserved_name"
  | "too_long"
  | "banned_extension";

export type UploadedFileNameValidation =
  | { ok: true; safeName: string }
  | { ok: false; safeName: string; reason: UploadedFileNameValidationFailure };

const UPLOADED_FILE_NAME_UNSAFE_CHAR_RE = /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/;
const BANNED_UPLOADED_FILE_EXTENSIONS = new Set([
  ".7z",
  ".app",
  ".bat",
  ".cab",
  ".cmd",
  ".deb",
  ".dll",
  ".dmg",
  ".exe",
  ".jar",
  ".js",
  ".lnk",
  ".mjs",
  ".ps1",
  ".rar",
  ".rpm",
  ".scr",
  ".sh",
  ".vbs",
  ".zip",
]);

export function sanitizeUploadedFileName(name: string): string {
  let base = name.split(/[/\\]/).pop() ?? "document";
  if (base === ".." || base === ".") base = "document";
  const cleaned = base.normalize("NFC").replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  return cleaned ? cleaned.slice(0, UPLOADED_FILE_NAME_MAX_LENGTH) : "document";
}

function uploadedFileExtensionTokens(name: string): string[] {
  const parts = name.toLowerCase().split(".").filter(Boolean);
  return parts.length > 1 ? parts.slice(1).map((part) => `.${part}`) : [];
}

export function validateUploadedFileName(name: string): UploadedFileNameValidation {
  const raw = String(name);
  const safeName = sanitizeUploadedFileName(raw);
  const normalized = raw.normalize("NFC").trim();

  if (!normalized) return { ok: false, safeName, reason: "empty" };
  if (/[\/\\]/.test(normalized)) return { ok: false, safeName, reason: "path_separator" };
  if (normalized.includes("%")) return { ok: false, safeName, reason: "control_character" };
  if (UPLOADED_FILE_NAME_UNSAFE_CHAR_RE.test(normalized)) {
    return { ok: false, safeName, reason: "control_character" };
  }
  if (normalized === "." || normalized === ".." || normalized.startsWith(".")) {
    return { ok: false, safeName, reason: "reserved_name" };
  }
  if (normalized.length > UPLOADED_FILE_NAME_MAX_LENGTH) {
    return { ok: false, safeName, reason: "too_long" };
  }
  if (uploadedFileExtensionTokens(normalized).some((extension) => BANNED_UPLOADED_FILE_EXTENSIONS.has(extension))) {
    return { ok: false, safeName, reason: "banned_extension" };
  }

  return { ok: true, safeName };
}
