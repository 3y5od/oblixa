/**
 * When a JSON body is expected, reject clearly wrong Content-Type if the client set one.
 * Missing Content-Type is allowed. `text/plain` is allowed because some runtimes default to it for string bodies.
 */
export function jsonContentTypeRejection(request: Request): { status: 415; body: { error: string } } | null {
  const ct = request.headers.get("content-type");
  if (ct == null || ct.trim() === "") return null;
  const lower = ct.toLowerCase();
  if (lower.includes("application/json") || lower.includes("text/plain")) return null;
  return { status: 415, body: { error: "Content-Type must be application/json" } };
}
