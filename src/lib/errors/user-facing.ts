/**
 * Map database / Supabase errors to safe, user-readable strings.
 */
const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "Authentication is temporarily unavailable. Try again in a few minutes.";

type AuthErrorInput =
  | string
  | {
      message?: unknown;
      status?: unknown;
      name?: unknown;
      code?: unknown;
    };

export function mapDataSourceError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("already exists")
  ) {
    return "That value is already in use. Try something different.";
  }
  if (
    lower.includes("foreign key") ||
    lower.includes("violates foreign key") ||
    lower.includes("referential")
  ) {
    return "This action could not be completed. Refresh the page and try again.";
  }
  if (lower.includes("permission denied") || lower.includes("rls")) {
    return "You do not have permission to do that.";
  }
  if (lower.includes("jwt") || lower.includes("session")) {
    return "Your session expired. Sign in again.";
  }
  if (message.length > 180 || looksLikeTechnicalDump(message)) {
    return "Something went wrong. Please try again.";
  }
  console.warn("mapDataSourceError: unmapped message:", message);
  return "An unexpected error occurred. Please try again.";
}

function looksLikeTechnicalDump(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (lower.includes("node_modules") || lower.includes("typeerror")) {
    return true;
  }
  if (raw.includes("    at ") || raw.includes("\n    at ")) {
    return true;
  }
  return false;
}

/** Supabase Auth errors — keep safe messages, soften harsh internals */
export function mapAuthError(error: AuthErrorInput): string {
  const message = typeof error === "string"
    ? error
    : typeof error.message === "string"
      ? error.message
      : String(error.message ?? "");
  const status = typeof error === "object" && error && typeof error.status === "number"
    ? error.status
    : undefined;
  const name = typeof error === "object" && error && typeof error.name === "string"
    ? error.name
    : "";
  const code = typeof error === "object" && error && typeof error.code === "string"
    ? error.code
    : "";
  const lower = message.toLowerCase();
  if (
    (typeof status === "number" && status >= 500) ||
    message.trim() === "{}" ||
    name.toLowerCase().includes("retryable") ||
    code.toLowerCase().includes("retryable") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("service temporarily unavailable") ||
    /\b5(?:02|03|04|20|21|22|23|24|30)\b/.test(lower)
  ) {
    return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  }
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (
    lower.includes("redirect") &&
    (lower.includes("not allowed") ||
      lower.includes("not valid") ||
      lower.includes("must use https") ||
      lower.includes("url configuration"))
  ) {
    return "This site URL is not allowed for auth redirects. Add it in Supabase under Authentication → URL Configuration.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (lower.includes("password")) {
    return mapDataSourceError(message);
  }
  return mapDataSourceError(message);
}
