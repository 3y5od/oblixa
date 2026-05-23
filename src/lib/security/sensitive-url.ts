export const SENSITIVE_URL_PARAM_NAMES = new Set([
  "access_token",
  "api_key",
  "auth_token",
  "code",
  "cookie",
  "key",
  "password",
  "private_url",
  "refresh_token",
  "secret",
  "signature",
  "signed_url",
  "state",
  "token",
]);

export function isSensitiveUrlParamName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replaceAll("-", "_");
  if (SENSITIVE_URL_PARAM_NAMES.has(normalized)) return true;
  return /(^|_)(token|secret|password|signature|cookie|api_key|private_url|signed_url|access_token|refresh_token)(_|$)/u.test(
    normalized
  );
}

export function stripSensitiveUrlParams(rawPath: string): string {
  const parsed = new URL(rawPath, "https://app.local");
  const safe = new URLSearchParams();
  parsed.searchParams.forEach((value, key) => {
    if (!isSensitiveUrlParamName(key)) safe.append(key, value);
  });
  const query = safe.toString();
  return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash}`;
}

export function urlContainsSensitiveParams(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, "https://app.local");
    return [...parsed.searchParams.keys()].some(isSensitiveUrlParamName);
  } catch {
    return false;
  }
}
