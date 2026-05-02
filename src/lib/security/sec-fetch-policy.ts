/**
 * For cookie-authenticated APIs called from browsers, reject cross-site POSTs
 * unless Sec-Fetch-Site allows same-origin / same-user-activation patterns.
 */
export function secFetchSiteAllowsSensitiveMutation(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const site = request.headers.get("sec-fetch-site")?.toLowerCase().trim();
  if (!site) return true;
  if (site === "same-origin" || site === "same-site") return true;
  if (site === "none") return true;
  return false;
}
