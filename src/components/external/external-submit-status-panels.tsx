import { LoadingCard } from "@/components/ui/segment-loading";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export function ExternalSubmitSuccessPanel() {
  return (
    <div className="ui-status-panel ui-status-panel-success mx-auto max-w-lg px-6 py-8 text-center">
      <p className="ui-section-title">Thank you</p>
      <p className="ui-support-copy mt-2 text-sm">Your response was recorded. You can close this page.</p>
    </div>
  );
}

export function ExternalSubmitLoadingPanel() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <LoadingCard className="space-y-4 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="ui-skeleton h-3 w-28 rounded" />
          <div className="ui-skeleton h-8 w-2/3 rounded" />
          <div className="ui-skeleton h-4 w-full rounded" />
        </div>
        <div className="ui-skeleton h-10 w-full rounded-lg" />
        <div className="ui-skeleton h-24 w-full rounded-lg" />
        <div className="ui-skeleton h-12 w-full rounded-lg" />
      </LoadingCard>
    </div>
  );
}

export function ExternalSubmitMissingPanel({
  loadError,
  onRetry,
}: {
  loadError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="ui-page-shell mx-auto max-w-lg p-6 text-center sm:p-8">
      <p className="ui-eyebrow">External workflow</p>
      <h1 className="ui-page-title mt-2 text-[1.7rem]">External response</h1>
      <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
        External action not found.
      </p>
      <p className="ui-alert-error mt-3" data-testid={surfaceTestIds.externalSubmitLoadError}>
        {loadError || "Unable to load this link."}
      </p>
      <button
        type="button"
        className="ui-btn-secondary mt-4 px-4 py-2 text-sm"
        data-testid={surfaceTestIds.externalSubmitRetryButton}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

export function ExternalSubmitExpiredPanel() {
  return (
    <div className="ui-page-shell mx-auto max-w-lg p-6 text-center text-sm text-[var(--text-secondary)] sm:p-8">
      This link has expired. Contact your Oblixa administrator for a new request.
    </div>
  );
}

export function ExternalSubmitClosedPanel({ status }: { status: string }) {
  return (
    <div className="ui-page-shell mx-auto max-w-lg p-6 text-center text-sm text-[var(--text-secondary)] sm:p-8">
      This request is no longer open (status: {status}).
    </div>
  );
}
