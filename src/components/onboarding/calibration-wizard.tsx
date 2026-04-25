"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  actionApply,
  actionSettings,
  actionSkipMinimal,
  actionSimpler,
  calibrationFlowSubtitle,
  calibrationFlowTitle,
  calibrationReviewTestIds,
  formatSetupChecklistSummary,
  labelForDashboardProfile,
  labelForNotificationSuppressAdvanced,
  labelForReportProfileSuppress,
  labelForSearchScope,
  modeLabels,
  options,
  reviewChangeLater,
  reviewSectionHeadings,
  reviewStepTitle,
  reviewUtilitiesNoneHidden,
  stepLabels,
} from "@/lib/onboarding/calibration-copy";
import type {
  CalibrationAnswersOptional,
  CalibrationAnswersRequired,
  CalibrationRecommendation,
} from "@/lib/onboarding/calibration-types";
import {
  completeQuestionnaireAcceptRecommendation,
  completeQuestionnaireOpenAdvancedSettings,
  completeQuestionnaireSimplerSetup,
  previewCalibrationRecommendation,
  recordQuestionnaireStarted,
  saveQuestionnaireProgress,
  skipQuestionnaireExplicitMinimal,
} from "@/actions/onboarding-calibration";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";
import {
  CALIBRATION_LAST_STEP_INDEX,
  CALIBRATION_REQUIRED_FIELD_ORDER,
  clampCalibrationWizardStep,
} from "@/lib/onboarding/calibration-wizard-step";

const REQUIRED_FIELDS = CALIBRATION_REQUIRED_FIELD_ORDER;
const LAST_STEP_INDEX = CALIBRATION_LAST_STEP_INDEX;

function labelForAdvancedKey(key: string): string {
  return WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function labelForAssuranceKey(key: string): string {
  return WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function labelForUtilityKey(key: string): string {
  return WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function CalibrationWizard(props: {
  initialRequired: Partial<CalibrationAnswersRequired>;
  initialOptional: CalibrationAnswersOptional;
  /** docs/onboarding.md §24.17 — from `?step=`; clamped on server. */
  initialStep?: number;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(() =>
    clampCalibrationWizardStep(props.initialStep ?? 0, props.initialRequired)
  );
  const [req, setReq] = useState<Partial<CalibrationAnswersRequired>>(props.initialRequired);
  const [opt, setOpt] = useState<CalibrationAnswersOptional>(props.initialOptional);
  const [preview, setPreview] = useState<CalibrationRecommendation | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [pending, startTransition] = useTransition();
  const wizardBusy = completing || pending;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void recordQuestionnaireStarted();
  }, []);

  const scheduleSave = useCallback(
    (nextReq: Partial<CalibrationAnswersRequired>, nextOpt: CalibrationAnswersOptional) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveQuestionnaireProgress({
          answers_required: nextReq,
          answers_optional: nextOpt,
        });
      }, 400);
    },
    []
  );

  useEffect(() => {
    scheduleSave(req, opt);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [req, opt, scheduleSave]);

  useEffect(() => {
    if (step === 0) return;
    titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== LAST_STEP_INDEX) return;
    const full = REQUIRED_FIELDS.every((k) => req[k] != null);
    if (!full) return;
    let cancelled = false;
    void (async () => {
      const res = await previewCalibrationRecommendation({
        answers_required: req as CalibrationAnswersRequired,
        answers_optional: opt,
      });
      if (cancelled) return;
      if (!res.ok) {
        setPreviewError(res.error);
        setPreview(null);
        return;
      }
      setPreviewError(null);
      setPreview(res.recommendation);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, req, opt]);

  function setRequired<K extends keyof CalibrationAnswersRequired>(key: K, value: CalibrationAnswersRequired[K]) {
    setReq((r) => ({ ...r, [key]: value }));
  }

  function canAdvanceFromCurrent(): boolean {
    if (step <= 6) {
      const key = REQUIRED_FIELDS[step];
      return req[key] != null;
    }
    if (step === 7) return true;
    if (step === LAST_STEP_INDEX) return preview != null && !previewError;
    return false;
  }

  function goNext() {
    if (!canAdvanceFromCurrent()) return;
    setStep((s) => Math.min(s + 1, LAST_STEP_INDEX));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function runComplete(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    then?: () => void
  ) {
    setActionError(null);
    setCompleting(true);
    startTransition(() => {
      void (async () => {
        try {
          const out = await fn();
          if (!out.ok) {
            setActionError("error" in out && out.error ? out.error : "Something went wrong.");
            return;
          }
          router.refresh();
          then?.();
        } finally {
          setCompleting(false);
        }
      })();
    });
  }

  const currentField = step <= 6 ? REQUIRED_FIELDS[step] : null;

  return (
    <div className="ui-page-stack motion-reduce:transition-none mx-auto max-w-2xl">
      <nav aria-label="Questionnaire progress">
        <p className="ui-eyebrow text-[var(--accent-strong)]">
          Step {step + 1} of {LAST_STEP_INDEX + 1}
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: LAST_STEP_INDEX + 1 }, (_, i) => (
            <li key={i}>
              <span
                className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] px-2 text-xs ${
                  i === step
                    ? "bg-[var(--accent-strong)] font-semibold text-[var(--accent-fg)]"
                    : "text-[var(--text-secondary)]"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i + 1}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <div aria-live="polite" className="sr-only">
        {actionError ?? previewError ?? ""}
      </div>
      {actionError && (
        <p className="ui-alert-error" role="alert">
          {actionError}
        </p>
      )}

      <section aria-labelledby="cal-step-title" className="ui-card-hero p-6 md:p-8">
        {step <= 6 && (
          <>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{calibrationFlowTitle}</p>
            {step === 0 ? (
              <p className="ui-muted-tight mt-2 text-sm">{calibrationFlowSubtitle}</p>
            ) : null}
            <h1 id="cal-step-title" ref={titleRef} tabIndex={-1} className="mt-4 text-[1.5rem] font-semibold text-[var(--text-primary)]">
              {currentField ? stepLabels[currentField] : ""}
            </h1>
          </>
        )}
        {step === 7 && (
          <h1 id="cal-step-title" ref={titleRef} tabIndex={-1} className="text-[1.5rem] font-semibold text-[var(--text-primary)]">
            {stepLabels.optional}
          </h1>
        )}
        {step === LAST_STEP_INDEX && (
          <h1 id="cal-step-title" ref={titleRef} tabIndex={-1} className="text-[1.5rem] font-semibold text-[var(--text-primary)]">
            {reviewStepTitle}
          </h1>
        )}

        {step <= 6 && currentField && (
          <ul className="mt-6 space-y-2">
            {options[currentField].map((o) => (
              <li key={o.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[1rem] border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white)] px-3.5 py-2.5 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)]">
                  <input
                    type="radio"
                    name={currentField}
                    value={o.id}
                    checked={req[currentField] === o.id}
                    onChange={() => setRequired(currentField, o.id)}
                    className="size-4"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {step === 7 && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Industry emphasis (optional)</p>
              <select
                className="ui-input mt-2 w-full"
                value={opt.industry_emphasis ?? "unspecified"}
                onChange={(e) =>
                  setOpt((o) => ({
                    ...o,
                    industry_emphasis: e.target.value as CalibrationAnswersOptional["industry_emphasis"],
                  }))
                }
              >
                {options.industry_emphasis.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Import volume (optional)</p>
              <select
                className="ui-input mt-2 w-full"
                value={opt.import_volume ?? "unknown"}
                onChange={(e) =>
                  setOpt((o) => ({
                    ...o,
                    import_volume: e.target.value as CalibrationAnswersOptional["import_volume"],
                  }))
                }
              >
                {options.import_volume.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Your role (optional)</p>
              <select
                className="ui-input mt-2 w-full"
                value={opt.org_role ?? "unspecified"}
                onChange={(e) =>
                  setOpt((o) => ({
                    ...o,
                    org_role: e.target.value as CalibrationAnswersOptional["org_role"],
                  }))
                }
              >
                {options.org_role.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === LAST_STEP_INDEX && (
          <div className="mt-6 space-y-4 text-sm text-[var(--text-secondary)]">
            {previewError && (
              <p className="text-[var(--danger-ink)]" role="alert">
                {previewError}
              </p>
            )}
            {preview && (
              <div data-testid={calibrationReviewTestIds.root} className="space-y-5">
                <div role="region" aria-labelledby="cal-review-summary-heading">
                  <h3
                    id="cal-review-summary-heading"
                    className="text-sm font-semibold text-[var(--text-primary)]"
                  >
                    {reviewSectionHeadings.summary}
                  </h3>
                  <p className="mt-2">
                    <span className="font-medium text-[var(--text-primary)]">{modeLabels[preview.recommended_workspace_mode]}</span>
                    <span className="text-[var(--text-secondary)]"> (recommended)</span>
                  </p>
                  <p className="ui-muted-tight mt-2">{reviewChangeLater}</p>
                </div>

                <div role="region" aria-labelledby="cal-review-adv-heading">
                  <h3 id="cal-review-adv-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.advanced}
                  </h3>
                  <ul className="mt-2 list-inside list-disc text-[var(--text-secondary)]">
                    {preview.recommended_advanced_families_enabled.length === 0 ? (
                      <li className="text-[var(--text-secondary)]">None (Core)</li>
                    ) : (
                      preview.recommended_advanced_families_enabled.map((k) => (
                        <li key={k}>{labelForAdvancedKey(k)}</li>
                      ))
                    )}
                  </ul>
                </div>

                <div role="region" aria-labelledby="cal-review-asm-heading">
                  <h3 id="cal-review-asm-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.assurance}
                  </h3>
                  <ul className="mt-2 list-inside list-disc text-[var(--text-secondary)]">
                    {preview.recommended_assurance_families_enabled.length === 0 ? (
                      <li className="text-[var(--text-secondary)]">None</li>
                    ) : (
                      preview.recommended_assurance_families_enabled.map((k) => (
                        <li key={k}>{labelForAssuranceKey(k)}</li>
                      ))
                    )}
                  </ul>
                </div>

                <div role="region" aria-labelledby="cal-review-landing-heading">
                  <h3 id="cal-review-landing-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.landing}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">{preview.recommended_default_landing_path}</p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-setup-heading"
                  data-testid={calibrationReviewTestIds.setup}
                >
                  <h3 id="cal-review-setup-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.setup}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {formatSetupChecklistSummary(preview.recommended_setup_checklist)}
                  </p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-reports-heading"
                  data-testid={calibrationReviewTestIds.reports}
                >
                  <h3 id="cal-review-reports-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.reports}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {labelForReportProfileSuppress(
                      preview.recommended_report_profile.suppress_incompatible_subscriptions
                    )}
                  </p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-home-heading"
                  data-testid={calibrationReviewTestIds.home}
                >
                  <h3 id="cal-review-home-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.home}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {labelForDashboardProfile(
                      preview.recommended_dashboard_profile,
                      preview.recommended_workspace_mode
                    )}
                  </p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-search-heading"
                  data-testid={calibrationReviewTestIds.searchScope}
                >
                  <h3 id="cal-review-search-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.search}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {labelForSearchScope(preview.recommended_search_scope)}
                  </p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-notify-heading"
                  data-testid={calibrationReviewTestIds.notifications}
                >
                  <h3 id="cal-review-notify-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.notifications}
                  </h3>
                  <p className="mt-2 text-[var(--text-secondary)]">
                    {labelForNotificationSuppressAdvanced(
                      preview.recommended_notification_profile.suppress_advanced_tiers
                    )}
                  </p>
                </div>

                <div
                  role="region"
                  aria-labelledby="cal-review-util-heading"
                  data-testid={calibrationReviewTestIds.utilities}
                >
                  <h3 id="cal-review-util-heading" className="text-sm font-semibold text-[var(--text-primary)]">
                    {reviewSectionHeadings.utilities}
                  </h3>
                  {preview.recommended_utility_modules_hidden.length === 0 ? (
                    <p className="mt-2 text-[var(--text-secondary)]">{reviewUtilitiesNoneHidden}</p>
                  ) : (
                    <ul className="mt-2 list-inside list-disc text-[var(--text-secondary)]">
                      {preview.recommended_utility_modules_hidden.map((k) => (
                        <li key={k}>Hidden: {labelForUtilityKey(k)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-4">
              <button
                type="button"
                disabled={wizardBusy || !preview}
                className="ui-btn-primary min-h-9 w-full px-4 py-2.5"
                onClick={() =>
                  runComplete(
                    () =>
                      completeQuestionnaireAcceptRecommendation({
                        answers_required: req as CalibrationAnswersRequired,
                        answers_optional: opt,
                      }),
                    () => router.replace("/dashboard")
                  )
                }
              >
                {actionApply}
              </button>
              <button
                type="button"
                disabled={wizardBusy}
                className="ui-btn-secondary min-h-9 w-full px-4 py-2.5"
                onClick={() => runComplete(() => completeQuestionnaireSimplerSetup(), () => router.replace("/dashboard"))}
              >
                {actionSimpler}
              </button>
              <button
                type="button"
                disabled={wizardBusy}
                className="ui-btn-secondary min-h-9 w-full px-4 py-2.5"
                onClick={() =>
                  runComplete(() => completeQuestionnaireOpenAdvancedSettings(), () =>
                    router.replace("/settings/product")
                  )
                }
              >
                {actionSettings}
              </button>
            </div>
          </div>
        )}

        {step < LAST_STEP_INDEX && (
          <div className="mt-8 flex flex-wrap gap-3">
            {step > 0 && (
              <button type="button" className="ui-btn-secondary min-h-9 px-4 py-2" onClick={goBack}>
                Back
              </button>
            )}
            <button
              type="button"
              className="ui-btn-primary min-h-9 px-4 py-2"
              disabled={!canAdvanceFromCurrent()}
              onClick={goNext}
            >
              {step === 7 ? "Continue to review" : "Next"}
            </button>
            {step <= 6 && (
              <>
                <button
                  type="button"
                  className="ui-link min-h-9 self-center text-sm"
                  disabled={wizardBusy}
                  onClick={() =>
                    runComplete(() => completeQuestionnaireSimplerSetup(), () => router.replace("/dashboard"))
                  }
                >
                  {actionSimpler}
                </button>
                <button
                  type="button"
                  className="ui-link min-h-9 self-center text-sm"
                  disabled={wizardBusy}
                  onClick={() =>
                    runComplete(() => skipQuestionnaireExplicitMinimal(), () => router.replace("/dashboard"))
                  }
                >
                  {actionSkipMinimal}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-[var(--text-tertiary)]">
        <Link href="/settings/product" className="ui-link">
          Product settings
        </Link>
      </p>
    </div>
  );
}
