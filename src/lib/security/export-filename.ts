const EXPORT_FILE_NAME_MAX_LENGTH = 120;
const EXPORT_FILE_NAME_TOKEN_MAX_LENGTH = 80;
const EXPORT_FILE_NAME_UNSAFE_RE = /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069";\\%]/g;
const RFC5987_EXTRA_UNSAFE_RE = /['()*]/g;

export function sanitizeExportFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "export";
  const cleaned = base
    .normalize("NFC")
    .replace(EXPORT_FILE_NAME_UNSAFE_RE, "")
    .trim()
    .replace(/^\.+|[.\s]+$/g, "");
  return cleaned ? cleaned.slice(0, EXPORT_FILE_NAME_MAX_LENGTH) : "export";
}

export function sanitizeExportFileNameToken(value: string): string {
  const token = sanitizeExportFileName(value).slice(0, EXPORT_FILE_NAME_TOKEN_MAX_LENGTH);
  return token || "export";
}

function asciiContentDispositionFileName(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+|[.\s]+$/g, "")
    .trim()
    .slice(0, EXPORT_FILE_NAME_MAX_LENGTH);
  return ascii || "export";
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(RFC5987_EXTRA_UNSAFE_RE, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function contentDispositionAttachment(name: string): string {
  const safeName = sanitizeExportFileName(name);
  const asciiName = asciiContentDispositionFileName(safeName);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987Value(safeName)}`;
}

export function contentDispositionInline(name: string): string {
  const safeName = sanitizeExportFileName(name);
  const asciiName = asciiContentDispositionFileName(safeName);
  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987Value(safeName)}`;
}
