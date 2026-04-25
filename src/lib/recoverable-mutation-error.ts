/**
 * Maps common server/auth errors to plain-language recovery copy for visible mutations.
 */
export function describeRecoverableMutationError(error: string): string {
  const lower = error.toLowerCase();
  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("aborterror") ||
    lower.includes("request aborted")
  ) {
    return "This took too long and longer than expected. Refresh the page to confirm whether the change already applied, then retry once if needed.";
  }
  if (
    lower.includes("not authenticated") ||
    lower.includes("session") ||
    lower.includes("sign in")
  ) {
    return "Your session expired. Sign in again, then retry.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("load failed")
  ) {
    return "We could not reach the server. Check your connection, refresh the record, and retry. If you were mid-action, confirm the result before repeating it.";
  }
  if (
    lower.includes("already running") ||
    lower.includes("already processing") ||
    lower.includes("duplicate key") ||
    lower.includes("conflict")
  ) {
    return "This change is already being processed or may have just applied. Refresh the record before trying again so you do not duplicate work.";
  }
  if (
    lower.includes("permission") ||
    lower.includes("access denied") ||
    lower.includes("viewers cannot")
  ) {
    return "You do not have permission to complete this action.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    /\b429\b/.test(lower)
  ) {
    return "This action is temporarily rate limited. Wait a minute, narrow the scope, or try again later instead of rapid retries.";
  }
  return error;
}
