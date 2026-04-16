/**
 * Map database / Supabase errors to safe, user-readable strings.
 */
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
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (lower.includes("password")) {
    return mapDataSourceError(message);
  }
  return mapDataSourceError(message);
}
