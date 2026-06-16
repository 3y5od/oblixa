import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { COLUMN_HEADING_CLASS } from "./security-settings-panel-constants";

type SecuritySettingsStepUpColumnProps = {
  stepUpPending: boolean;
  stepUpVia: "password" | "aal2" | null;
  optimisticStepUpActive: boolean;
  needsStepUpPrompt: boolean;
  stepUpLabel: string;
  stepUpTone: "healthy" | "warning" | "empty";
  stepUpIcon: ReactNode;
  password: string;
  stepUpHelpId: string;
  idempotencyKey: string;
  onPasswordChange: (value: string) => void;
  onStepUp: (event: FormEvent<HTMLFormElement>) => void;
};

export function SecuritySettingsStepUpColumn({
  stepUpPending,
  stepUpVia,
  optimisticStepUpActive,
  needsStepUpPrompt,
  stepUpLabel,
  stepUpTone,
  stepUpIcon,
  password,
  stepUpHelpId,
  idempotencyKey,
  onPasswordChange,
  onStepUp,
}: SecuritySettingsStepUpColumnProps) {
  return (
    <div id="step-up-card" aria-busy={stepUpPending} className="min-w-0 px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className={COLUMN_HEADING_CLASS}>
          <KeyRound className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
          {SETTINGS_SECURITY_STRINGS.sections.stepUpColumn}
        </h3>
        <span className="shrink-0">
          <StatusBadge status={stepUpTone} className="gap-1 whitespace-nowrap">
            {stepUpIcon}
            {stepUpLabel}
          </StatusBadge>
        </span>
      </div>

      <p className="mt-3 text-[12.5px] leading-snug text-[var(--text-secondary)]">
        {SETTINGS_SECURITY_STRINGS.sensitiveActionsWhy}
      </p>

      {stepUpVia === "aal2" && !optimisticStepUpActive ? (
        <p className="ui-caps-3 mt-3 text-[var(--success-ink)]">{SETTINGS_SECURITY_STRINGS.stepUpAal2Note}</p>
      ) : null}

      {needsStepUpPrompt ? (
        <p className="mt-3 text-[12.5px] text-[var(--warning-ink)]">
          {SETTINGS_SECURITY_STRINGS.stepUpRequiredPrompt}
        </p>
      ) : null}

      <noscript>
        <form action="/api/settings/step-up" method="POST" className="mt-3 flex max-w-sm flex-col gap-3">
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <label htmlFor="stepup-pass-ns" className="ui-label">
            Account password
          </label>
          <input
            id="stepup-pass-ns"
            name="password"
            type="password"
            autoComplete="current-password"
            className="ui-input"
            placeholder={SETTINGS_SECURITY_STRINGS.passwordPlaceholder}
          />
          <button type="submit" className="ui-btn-primary rounded-full px-4 py-2 text-sm">
            {SETTINGS_SECURITY_STRINGS.stepUpFormCta}
          </button>
        </form>
      </noscript>

      <form noValidate onSubmit={onStepUp} className="mt-3 flex max-w-sm flex-col gap-3 billing-no-print">
        <div>
          <label htmlFor="stepup-pass" className="ui-label">
            Account password
          </label>
          <div className="relative mt-1">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
              strokeWidth={1.85}
              aria-hidden
            />
            <input
              id="stepup-pass"
              name="password"
              type="password"
              autoComplete="current-password"
              className="ui-input w-full pl-9"
              placeholder={SETTINGS_SECURITY_STRINGS.passwordPlaceholder}
              aria-describedby={stepUpHelpId}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
          <span id={stepUpHelpId} className="sr-only">
            {SETTINGS_SECURITY_STRINGS.stepUpFormHelp}
          </span>
        </div>
        <AsyncActionButton
          type="submit"
          className="ui-btn-primary inline-flex w-full items-center gap-1 rounded-full px-4 py-2 text-sm sm:w-auto sm:self-start"
          pending={stepUpPending}
          pendingLabel="Confirming..."
        >
          {SETTINGS_SECURITY_STRINGS.stepUpFormCta}
        </AsyncActionButton>
      </form>

      <div className="mt-4 border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)] pt-3">
        <p className="ui-caps-3 text-[var(--text-tertiary)]">Account recovery</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/settings/account?action=change-password" className="ui-link text-[12.5px]">
            {SETTINGS_SECURITY_STRINGS.passwordChangeCta}
          </Link>
          <Link href="/auth/forgot-password" className="ui-link text-[12.5px] text-[var(--text-tertiary)] billing-no-print">
            {SETTINGS_SECURITY_STRINGS.forgotPasswordCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
