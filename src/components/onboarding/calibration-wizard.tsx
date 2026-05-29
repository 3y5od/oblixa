"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionApply,
  actionSimpler,
  calibrationFlowSubtitle,
  calibrationFlowTitle,
  calibrationReviewTestIds,
  formatSetupChecklistSummary,
  options,
  reviewSectionHeadings,
  reviewStepTitle,
  stepLabels,
} from "@/lib/onboarding/calibration-copy";
import type {
  CalibrationAnswersOptional,
  CalibrationAnswersRequired,
  CalibrationRecommendation,
} from "@/lib/onboarding/calibration-types";
import {
  completeQuestionnaireAcceptRecommendation,
  previewCalibrationRecommendation,
  recordQuestionnaireStarted,
  saveQuestionnaireProgress,
} from "@/actions/onboarding-calibration";
import {
  CALIBRATION_LAST_STEP_INDEX,
  CALIBRATION_REQUIRED_FIELD_ORDER,
  clampCalibrationWizardStep,
} from "@/lib/onboarding/calibration-wizard-step";
import { replaceAppHref } from "@/lib/navigation/client-navigation";

const REQUIRED_FIELDS = CALIBRATION_REQUIRED_FIELD_ORDER;
const LAST_STEP_INDEX = CALIBRATION_LAST_STEP_INDEX;

export function CalibrationWizard(props: {
  initialRequired: Partial<CalibrationAnswersRequired>;
  initialOptional: CalibrationAnswersOptional;
  /** onboarding spec §24.17 — from `?step=`; clamped on server. */
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
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_86%,white)] px-3.5 py-2.5 hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)]">
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
                  <p className="mt-2 text-[var(--text-secondary)]">
                    Your workspace is ready to track contracts. Start with a signed agreement, then review fields,
                    assign an owner, track dates, and turn obligations into work.
                  </p>
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
                    Reports become useful as you review fields, assign owners, add dates, and track work.
                  </p>
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
                    () => replaceAppHref(router, "/contracts/new")
                  )
                }
              >
                {actionApply}
              </button>
              <button
                type="button"
                disabled={wizardBusy}
                className="ui-btn-secondary min-h-9 w-full px-4 py-2.5"
                onClick={() =>
                  runComplete(
                    () =>
                      completeQuestionnaireAcceptRecommendation({
                        answers_required: req as CalibrationAnswersRequired,
                        answers_optional: opt,
                      }),
                    () => replaceAppHref(router, "/dashboard")
                  )
                }
              >
                {actionSimpler}
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
          </div>
        )}
      </section>
    </div>
  );
}
