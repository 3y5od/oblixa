type RequiredServerEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_PRICE_ID";

const requiredCache = new Map<RequiredServerEnvKey, string>();

export function requireServerEnv(key: RequiredServerEnvKey): string {
  const cached = requiredCache.get(key);
  if (cached) return cached;

  const raw = process.env[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    throw new Error(`[env] Missing required server env var: ${key}`);
  }

  requiredCache.set(key, value);
  return value;
}

export function getSupabasePublicEnv() {
  return {
    url: requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseServiceRoleKey(): string {
  return requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getStripeServerEnv() {
  return {
    secretKey: requireServerEnv("STRIPE_SECRET_KEY"),
    priceId: requireServerEnv("STRIPE_PRICE_ID"),
  };
}

export function getOptionalServerEnv(key: string): string | null {
  const raw = process.env[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  return value || null;
}

/**
 * 32-byte base64 key used to encrypt integration access/refresh tokens at rest.
 * Example generation:
 * `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
 */
export function getIntegrationTokenEncryptionKey(): string {
  const value = getOptionalServerEnv("INTEGRATION_TOKEN_ENCRYPTION_KEY");
  if (!value) {
    throw new Error(
      "[env] Missing required server env var: INTEGRATION_TOKEN_ENCRYPTION_KEY"
    );
  }
  return value;
}
