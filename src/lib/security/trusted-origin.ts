const TRUSTED_ORIGINS_ENV = "OBLIXA_TRUSTED_APP_ORIGINS";

type HeaderGetter = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")[0]
    ?.trim() ?? "";
}

export function isProductionLikeOriginEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV === "production" ||
    String(env.VERCEL_ENV ?? "").trim() === "production" ||
    String(env.VERCEL ?? "").trim() === "1"
  );
}

export function normalizeAppOrigin(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower === "[::1]";
}

export function isLocalOrigin(origin: string): boolean {
  const normalized = normalizeAppOrigin(origin);
  if (!normalized) return false;
  return isLocalHostname(new URL(normalized).hostname);
}

function appOriginEnvCandidates(env: NodeJS.ProcessEnv): string[] {
  const explicit = String(env[TRUSTED_ORIGINS_ENV] ?? "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [
    ...explicit,
    env.NEXT_PUBLIC_APP_URL,
    env.APP_BASE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
  ].flatMap((value) => (typeof value === "string" && value.trim() ? [value.trim()] : []));
}

export function getTrustedAppOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const productionLike = isProductionLikeOriginEnv(env);
  const origins = new Set<string>();
  for (const candidate of appOriginEnvCandidates(env)) {
    const origin = normalizeAppOrigin(candidate);
    if (!origin) continue;
    if (productionLike && isLocalOrigin(origin)) continue;
    origins.add(origin);
  }
  return origins;
}

export function getCanonicalTrustedAppOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const origin of getTrustedAppOrigins(env)) return origin;
  return isProductionLikeOriginEnv(env) ? null : "http://localhost:3000";
}

export function isTrustedAppOrigin(origin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = normalizeAppOrigin(origin);
  if (!normalized) return false;
  if (!isProductionLikeOriginEnv(env)) return true;
  if (isLocalOrigin(normalized)) return false;
  return getTrustedAppOrigins(env).has(normalized);
}

function originFromHostAndProto(
  hostValue: string | null | undefined,
  protoValue: string | null | undefined
): string | null {
  const host = firstHeaderValue(hostValue);
  if (!host || /[\\/@]/.test(host)) return null;
  const proto = firstHeaderValue(protoValue).toLowerCase();
  const scheme =
    proto === "http" || proto === "https"
      ? proto
      : host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https";
  return normalizeAppOrigin(`${scheme}://${host}`);
}

export function resolveTrustedOriginFromHeaders(
  headers: HeaderGetter,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const forwardedProto = headers.get("x-forwarded-proto");
  const candidates = [
    originFromHostAndProto(headers.get("x-forwarded-host"), forwardedProto),
    originFromHostAndProto(headers.get("host"), forwardedProto),
  ];
  for (const candidate of candidates) {
    if (candidate && isTrustedAppOrigin(candidate, env)) return candidate;
  }
  return null;
}

export function resolveTrustedOriginFromRequest(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const headerOrigin = resolveTrustedOriginFromHeaders(request.headers, env);
  if (headerOrigin) return headerOrigin;
  const requestOrigin = normalizeAppOrigin(new URL(request.url).origin);
  return requestOrigin && isTrustedAppOrigin(requestOrigin, env) ? requestOrigin : null;
}
