/**
 * When a JSON body is expected, require an unambiguous JSON media type.
 */
export function jsonContentTypeRejection(request: Request): { status: 415; details: { expected: string; received: string } } | null {
  const ct = request.headers.get("content-type");
  if (ct == null || ct.trim() === "") {
    return { status: 415, details: { expected: "application/json", received: "missing" } };
  }

  const lower = ct.toLowerCase().trim();
  if (lower.includes(",")) {
    return { status: 415, details: { expected: "application/json", received: lower.slice(0, 120) } };
  }

  const mediaType = lower.split(";", 1)[0]?.trim() ?? "";
  if (mediaType === "application/json" || /^application\/[a-z0-9.+-]+\+json$/u.test(mediaType)) return null;
  return { status: 415, details: { expected: "application/json", received: lower.slice(0, 120) } };
}
