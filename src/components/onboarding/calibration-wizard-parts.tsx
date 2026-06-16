"use client";

import type { Dispatch, SetStateAction } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { options } from "@/lib/onboarding/calibration-copy";
import type { CalibrationAnswersOptional } from "@/lib/onboarding/calibration-types";

export function CalibrationProgressNav({
  step,
  lastStepIndex,
}: {
  step: number;
  lastStepIndex: number;
}) {
  return (
    <nav aria-label="Questionnaire progress">
      <p className="ui-eyebrow text-[var(--accent-strong)]">
        Step {step + 1} of {lastStepIndex + 1}
      </p>
      <ol className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: lastStepIndex + 1 }, (_, i) => (
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
  );
}

export function CalibrationStepNavigation({
  step,
  lastStepIndex,
  canAdvance,
  onBack,
  onNext,
}: {
  step: number;
  lastStepIndex: number;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  if (step >= lastStepIndex) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {step > 0 && (
        <button type="button" className="ui-btn-secondary min-h-9 px-4 py-2" onClick={onBack}>
          Back
        </button>
      )}
      <button
        type="button"
        className="ui-btn-primary min-h-9 px-4 py-2"
        disabled={!canAdvance}
        onClick={onNext}
      >
        {step === lastStepIndex - 1 ? "Continue to review" : "Next"}
      </button>
    </div>
  );
}

export function CalibrationOptionalStep({
  opt,
  setOpt,
}: {
  opt: CalibrationAnswersOptional;
  setOpt: Dispatch<SetStateAction<CalibrationAnswersOptional>>;
}) {
  return (
    <div className="mt-6 space-y-5">
      <FormSelect
        label="Industry emphasis (optional)"
        value={opt.industry_emphasis ?? "unspecified"}
        onChange={(v) =>
          setOpt((o) => ({
            ...o,
            industry_emphasis: v as CalibrationAnswersOptional["industry_emphasis"],
          }))
        }
        options={options.industry_emphasis.map((o) => ({
          value: o.id,
          label: o.label,
        }))}
      />
      <FormSelect
        label="Import volume (optional)"
        value={opt.import_volume ?? "unknown"}
        onChange={(v) =>
          setOpt((o) => ({
            ...o,
            import_volume: v as CalibrationAnswersOptional["import_volume"],
          }))
        }
        options={options.import_volume.map((o) => ({
          value: o.id,
          label: o.label,
        }))}
      />
      <FormSelect
        label="Your role (optional)"
        value={opt.org_role ?? "unspecified"}
        onChange={(v) =>
          setOpt((o) => ({
            ...o,
            org_role: v as CalibrationAnswersOptional["org_role"],
          }))
        }
        options={options.org_role.map((o) => ({
          value: o.id,
          label: o.label,
        }))}
      />
    </div>
  );
}
