/**
 * Application uses Supabase session JWTs via the Supabase client — no custom
 * `jwt.verify` / remote JWKS fetching in-repo. Keep this marker for audits.
 */
export const CUSTOM_JWT_VERIFY_NOT_USED = true as const;
