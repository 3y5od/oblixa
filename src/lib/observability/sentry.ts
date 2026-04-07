import * as Sentry from "@sentry/nextjs";

function hasServerDsn(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function hasClientDsn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}

export function captureServerException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!hasServerDsn()) return;
  Sentry.captureException(error, context);
}

export function captureServerMessage(
  message: string,
  context?: Parameters<typeof Sentry.captureMessage>[1]
): void {
  if (!hasServerDsn()) return;
  Sentry.captureMessage(message, context);
}

export function captureClientException(
  error: unknown,
  context?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (!hasClientDsn()) return;
  Sentry.captureException(error, context);
}
