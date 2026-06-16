import type { FormEvent, RefObject } from "react";
import { Check, ChevronRight, Copy, Smartphone, TriangleAlert } from "lucide-react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { InlineMutationStatus } from "@/components/ui/inline-mutation-status";
import { StatusBadge } from "@/components/ui/status-badge";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { ADD_AUTH_BTN_ID, COLUMN_HEADING_CLASS } from "./security-settings-panel-constants";
import type { EnrollState, TotpFactorRow } from "./security-settings-panel-types";

type SecuritySettingsMfaColumnProps = {
  factors: TotpFactorRow[];
  factorsEmpty: boolean;
  showDangerEmptyState: boolean;
  mfaAvailable: boolean;
  error: string | null;
  message: string | null;
  pending: boolean;
  pendingFactorId: string | null;
  enroll: EnrollState;
  qrSrc: string | null;
  code: string;
  verifyError: string | null;
  copiedSecret: boolean;
  copyFallback: boolean;
  enrollHeadingRef: RefObject<HTMLHeadingElement | null>;
  totpHintId: string;
  totpErrorId: string;
  onStartEnrollment: () => void;
  onVerifyEnrollment: (event: FormEvent<HTMLFormElement>) => void;
  onCodeChange: (value: string) => void;
  onCopyManualKey: (secret: string) => void;
  onCancelEnrollment: () => void;
  onRequestRemoveFactor: (id: string, idx: number) => void;
};

export function SecuritySettingsMfaColumn({
  factors,
  factorsEmpty,
  showDangerEmptyState,
  mfaAvailable,
  error,
  message,
  pending,
  pendingFactorId,
  enroll,
  qrSrc,
  code,
  verifyError,
  copiedSecret,
  copyFallback,
  enrollHeadingRef,
  totpHintId,
  totpErrorId,
  onStartEnrollment,
  onVerifyEnrollment,
  onCodeChange,
  onCopyManualKey,
  onCancelEnrollment,
  onRequestRemoveFactor,
}: SecuritySettingsMfaColumnProps) {
  return (
    <div id="mfa-card" aria-busy={pending && (enroll != null || pendingFactorId != null)} className="min-w-0 px-5 py-5">
      <h3 className={COLUMN_HEADING_CLASS}>
        <Smartphone className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        {SETTINGS_SECURITY_STRINGS.sections.mfaColumn}
      </h3>

      <InlineMutationStatus message={error ?? message} variant={error ? "error" : "success"} className="mb-3 mt-3 text-sm" />

      {factorsEmpty ? (
        <div
          className="mt-3 flex flex-col gap-2 rounded-lg border px-3 py-3"
          style={{
            borderColor:
              showDangerEmptyState && mfaAvailable
                ? "color-mix(in oklab, var(--danger-ink) 28%, var(--border-subtle))"
                : "color-mix(in oklab, var(--warning-soft) 55%, var(--border-subtle))",
            background:
              showDangerEmptyState && mfaAvailable
                ? "color-mix(in oklab, var(--danger-soft) 18%, var(--surface-raised))"
                : "color-mix(in oklab, var(--warning-soft) 18%, var(--surface-raised))",
          }}
        >
          <StatusBadge
            status={!mfaAvailable ? "disabled" : showDangerEmptyState ? "critical" : "warning"}
            className="gap-1 self-start"
          >
            <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
            {!mfaAvailable ? SETTINGS_SECURITY_STRINGS.mfaUnavailableLabel : SETTINGS_SECURITY_STRINGS.mfaEmptyLabel}
          </StatusBadge>
          <p
            className="text-[12.5px] leading-snug"
            style={{
              color: showDangerEmptyState && mfaAvailable ? "var(--danger-ink)" : "var(--text-secondary)",
            }}
          >
            {!mfaAvailable
              ? SETTINGS_SECURITY_STRINGS.mfaUnavailableBody
              : showDangerEmptyState
                ? SETTINGS_SECURITY_STRINGS.mfaEmptyBodyRequired
                : SETTINGS_SECURITY_STRINGS.mfaEmptyBody}
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)]">
          {factors.map((f, idx) => (
            <li key={f.id} aria-busy={pendingFactorId === f.id} className="group flex flex-wrap items-center gap-3 py-3">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: f.status === "verified" ? "var(--success-ink)" : "var(--warning-ink)" }}
              />
              <span className="min-w-0 flex-1 text-[13.5px] text-[var(--text-primary)]">
                {f.friendly_name ?? SETTINGS_SECURITY_STRINGS.factorFallbackName(idx)}
              </span>
              <StatusBadge status={f.status === "verified" ? "healthy" : "warning"}>{f.status.toUpperCase()}</StatusBadge>
              <button
                type="button"
                className="ui-btn-secondary inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] billing-no-print"
                disabled={pending}
                aria-label={`Remove authenticator ${f.friendly_name ?? idx + 1}`}
                onClick={() => onRequestRemoveFactor(f.id, idx)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!mfaAvailable ? null : !enroll ? (
        <AsyncActionButton
          id={ADD_AUTH_BTN_ID}
          type="button"
          className={`${factorsEmpty ? "ui-btn-primary" : "ui-btn-secondary"} mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm billing-no-print`}
          pending={pending}
          pendingLabel="Preparing..."
          onClick={onStartEnrollment}
        >
          Enroll authenticator
        </AsyncActionButton>
      ) : (
        <div role="region" aria-live="polite" aria-label="Authenticator enrollment" className="mt-4 space-y-4">
          <h4 ref={enrollHeadingRef} tabIndex={-1} className="ui-caps-2 text-[var(--text-tertiary)] outline-none">
            ENROLL AUTHENTICATOR
          </h4>
          {qrSrc ? (
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={SETTINGS_SECURITY_STRINGS.qrAlt} className="h-40 w-40 object-contain sm:h-48 sm:w-48" />
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-caps-3 text-[var(--text-tertiary)]">{SETTINGS_SECURITY_STRINGS.manualKeyEyebrow}</span>
              <span className="ui-caps-3 text-[var(--warning-ink)]">{SETTINGS_SECURITY_STRINGS.manualKeyWarning}</span>
              <button
                type="button"
                className="ui-btn-ghost ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] billing-no-print"
                onClick={() => onCopyManualKey(enroll.secret)}
              >
                {copiedSecret ? (
                  <>
                    <Check className="h-3 w-3 text-[var(--success-ink)]" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 opacity-60" aria-hidden />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="mt-1 font-mono break-all text-[12px] text-[var(--text-secondary)]">{enroll.secret}</p>
            {copyFallback ? <p className="ui-caps-3 mt-1 text-[var(--warning-ink)]">PRESS CTRL+C / CMD+C TO COPY</p> : null}
          </div>

          <form noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onVerifyEnrollment}>
            <div className="min-w-0 flex-1">
              <label htmlFor="totp-code" className="ui-label">
                Verification code
              </label>
              <input
                id="totp-code"
                className={`ui-input mt-1 w-full ${verifyError ? "ui-input-error" : ""}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                aria-invalid={!!verifyError}
                aria-describedby={verifyError ? totpErrorId : totpHintId}
                value={code}
                onChange={(ev) => onCodeChange(ev.target.value)}
              />
              {verifyError ? (
                <p id={totpErrorId} className="ui-caps-3 mt-1 text-[var(--danger-ink)]">
                  {verifyError}
                </p>
              ) : (
                <p id={totpHintId} className="ui-caps-3 mt-1 text-[var(--text-tertiary)]">
                  {SETTINGS_SECURITY_STRINGS.totpCodeHint}
                </p>
              )}
            </div>
            <AsyncActionButton
              type="submit"
              className="ui-btn-primary inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm billing-no-print"
              pending={pending}
              pendingLabel="Confirming..."
            >
              Confirm
            </AsyncActionButton>
          </form>
          <button
            type="button"
            className="ui-btn-ghost inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] text-[var(--text-tertiary)] billing-no-print"
            onClick={onCancelEnrollment}
          >
            {SETTINGS_SECURITY_STRINGS.enrollmentCancelCta}
          </button>
        </div>
      )}

      {factorsEmpty && !enroll && mfaAvailable ? (
        <details className="group mt-4">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)] marker:hidden hover:underline [&::-webkit-details-marker]:hidden">
            {SETTINGS_SECURITY_STRINGS.mfaExplainerSummary}
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90 motion-reduce:transition-none" strokeWidth={1.85} aria-hidden />
          </summary>
          <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {SETTINGS_SECURITY_STRINGS.mfaExplainerBody}
          </p>
        </details>
      ) : null}
    </div>
  );
}
