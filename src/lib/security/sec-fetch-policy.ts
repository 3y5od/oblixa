/**
 * For cookie-authenticated APIs called from browsers, reject cross-site POSTs
 * unless Sec-Fetch-Site allows same-origin / same-user-activation patterns.
 */
export function secFetchSiteAllowsSensitiveMutation(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try {
      if (new URL(origin).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer")?.trim();
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site")?.toLowerCase().trim();
  if (!origin && !referer && !site) return false;
  if (site === "same-origin" || site === "same-site") return true;
  if (site === "none") return true;
  if (site) return false;
  return true;
}

export const METHOD_OVERRIDE_HEADERS = [
  "x-http-method-override",
  "x-method-override",
  "x-http-method",
  "x-method",
] as const;

export const METHOD_OVERRIDE_QUERY_PARAMS = [
  "_method",
  "method",
  "httpMethod",
  "x-http-method-override",
  "x-method-override",
] as const;

export function hasMethodOverrideAttempt(request: Request): boolean {
  for (const header of METHOD_OVERRIDE_HEADERS) {
    if (request.headers.has(header)) return true;
  }
  const url = new URL(request.url);
  for (const param of METHOD_OVERRIDE_QUERY_PARAMS) {
    if (url.searchParams.has(param)) return true;
  }
  return false;
}
