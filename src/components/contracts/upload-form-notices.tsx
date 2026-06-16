import { CheckCircle2 } from "lucide-react";

export function UploadFormNotices({
  disabled,
  disabledReason,
  error,
  uploadOutcome,
  fileNotice,
  pendingNotice,
  hydratedFromStorage,
  hasMeaningfulDraft,
}: {
  disabled?: boolean;
  disabledReason?: string;
  error: string | null;
  uploadOutcome: string | null;
  fileNotice: string | null;
  pendingNotice: string | null;
  hydratedFromStorage: boolean;
  hasMeaningfulDraft: boolean;
}) {
  const showNotices =
    (disabled && disabledReason) ||
    error ||
    (uploadOutcome && !error) ||
    (fileNotice && !error) ||
    (pendingNotice && !error) ||
    (hydratedFromStorage && hasMeaningfulDraft && !error);

  if (!showNotices) return null;

  return (
    <div className="space-y-3 px-5 pb-1 pt-5 sm:px-6">
      {disabled && disabledReason ? (
        <div className="ui-alert-warning" role="alert">
          {disabledReason}
        </div>
      ) : null}
      {error ? (
        <div className="ui-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {uploadOutcome && !error ? (
        <div className="ui-alert-success flex items-start gap-2" role="status" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{uploadOutcome}</span>
        </div>
      ) : null}
      {fileNotice && !error ? (
        <div className="ui-alert-warning" role="status" aria-live="polite">
          {fileNotice}
        </div>
      ) : null}
      {pendingNotice && !error ? (
        <div className="ui-soft-details px-4 py-3 text-[12.5px] text-[var(--text-secondary)]" role="status" aria-live="polite">
          {pendingNotice}
        </div>
      ) : null}
      {hydratedFromStorage && hasMeaningfulDraft && !error ? (
        <div className="ui-status-panel ui-status-panel-info px-4 py-2 text-[12.5px]" role="status">
          Your contract details are saved in this browser until you create the contract or clear the form.
        </div>
      ) : null}
    </div>
  );
}
