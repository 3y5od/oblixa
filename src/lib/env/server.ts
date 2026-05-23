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

/** Optional second priceId for monthly billing variant. */
export function getStripeMonthlyPriceId(): string | null {
  return getOptionalServerEnv("STRIPE_MONTHLY_PRICE_ID");
}

/** Optional Stripe coupon ID applied for Founding Customer offer. */
export function getStripeFoundingCouponId(): string | null {
  return getOptionalServerEnv("STRIPE_FOUNDING_COUPON_ID");
}

/** Optional feature flag: enable ACH/us_bank_account at checkout. */
export function isStripeAchEnabled(): boolean {
  return getOptionalServerEnv("STRIPE_ENABLE_ACH") === "1";
}

/** Optional feature flag: enable Stripe Tax + ToS consent collection. */
export function isStripeTaxEnabled(): boolean {
  return getOptionalServerEnv("STRIPE_TAX_ENABLED") === "1";
}

export function isStripeTosCollectionEnabled(): boolean {
  return getOptionalServerEnv("STRIPE_TOS_COLLECTION_ENABLED") === "1";
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
