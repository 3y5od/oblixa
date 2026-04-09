/**
 * Release identifier for Sentry (deploy correlation).
 * Prefer `SENTRY_RELEASE`; otherwise use CI/Vercel/Git SHA when present.
 */
export function getSentryRelease(): string | undefined {
  const v =
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim();
  return v || undefined;
}
