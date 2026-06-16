import Link from "next/link";
import { startRecalibrationFromSettingsForm } from "@/actions/onboarding-calibration";
import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";
import { SettingsProductCalibrationExport } from "@/app/(dashboard)/settings/product/settings-product-calibration-export";
import { SettingsProductCalibrationSummary } from "@/app/(dashboard)/settings/product/settings-product-calibration-summary";

export function ProductModeExplanation() {
  return (
    <div>
      <details className="mt-4 max-w-2xl rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
          What each mode changes
        </summary>
        <div className="ui-muted-tight mt-3 space-y-3 text-[12.5px] text-[var(--text-secondary)]">
          <p>
            <strong>Advanced</strong> adds primary navigation and contextual entry for programs,
            decisions, campaigns, and relationships; home may show portfolio-style strips when not
            hidden below.
          </p>
          <p>
            <strong>Assurance</strong> adds the Assurance section (findings, policies, scorecards,
            playbooks, review boards, autopilot, segments, program evolution, health graph), richer
            reports anchors, and assurance-oriented notifications when enabled.
          </p>
          <p>
            <strong>Checklist</strong> — this page covers workspace mode, per-module hides,
            optional advanced-nav roles, default landing path, admin testing flag for Assurance nav,
            autopilot execution gate, home block hides, and email category mutes.
          </p>
          <p>
            <strong>Feature mapping</strong> — feature visibility by mode and advanced module reveal: workspace
            mode + hide checkboxes. Home composition: “Home dashboard blocks”. Notification categories: “Email
            notification categories”. Linked workspace workflow knobs live under{" "}
            <Link href="/settings/operations" className="ui-link">
              Settings → Operations
            </Link>{" "}
            (exports/integrations copy) and{" "}
            <Link href="/settings/policy" className="ui-link">
              Policy
            </Link>
            , and{" "}
            <Link href="/settings/health" className="ui-link">
              Health
            </Link>{" "}
            where applicable.
          </p>
        </div>
      </details>
      <Link href="/settings" className="ui-link mt-4 inline-block text-sm">
        Back to settings
      </Link>
    </div>
  );
}

export function ProductCalibrationSection({
  onboardingCal,
  orgFingerprint,
}: {
  onboardingCal: OnboardingCalibrationState | null | undefined;
  orgFingerprint: string;
}) {
  return (
    <section className="ui-page-shell bg-surface p-6 md:p-8">
      <p className="ui-label-caps">Workspace setup questionnaire</p>
      <p className="ui-support-copy mt-2">
        {onboardingCal ? (
          <>
            Calibrated:{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {onboardingCal.last_applied || onboardingCal.status === "completed"
                ? "Yes"
                : onboardingCal.status === "skipped"
                  ? "Skipped (minimal)"
                  : "In progress"}
            </span>
              {onboardingCal.last_applied?.applied_at ? (
              <>
                {" "}
                · Last applied{" "}
                {new Date(onboardingCal.last_applied.applied_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </>
            ) : onboardingCal.questionnaire_completed_at ? (
              <>
                {" "}
                · Completed{" "}
                {new Date(onboardingCal.questionnaire_completed_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </>
            ) : null}
          </>
        ) : (
          "No questionnaire record is stored for this workspace yet."
        )}
      </p>
      <form action={startRecalibrationFromSettingsForm} className="mt-4">
        <button type="submit" className="ui-btn-secondary px-4 py-2 text-sm">
          Run calibration again
        </button>
      </form>
      <p className="ui-support-copy mt-2 text-[12.5px]">
        Opens the setup flow without blocking navigation. Workspace mode and module visibility below
        remain the source of truth until you apply a new recommendation.
      </p>
      {onboardingCal ? <SettingsProductCalibrationExport orgFingerprint={orgFingerprint} /> : null}
      {onboardingCal ? (
        <div data-settings-calibration-summary="">
          <SettingsProductCalibrationSummary cal={onboardingCal} />
        </div>
      ) : null}
      {onboardingCal &&
        onboardingCal.answers_required &&
        Object.keys(onboardingCal.answers_required).length > 0 && (
          <details className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/30 p-3">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
              Last questionnaire answers (read-only)
            </summary>
            <pre className="ui-muted-tight mt-3 max-h-52 overflow-auto rounded-md bg-surface p-3 text-[11px] leading-relaxed text-[var(--text-primary)]">
              {JSON.stringify(
                {
                  answers_required: onboardingCal.answers_required,
                  answers_optional: onboardingCal.answers_optional ?? {},
                },
                null,
                2
              )}
            </pre>
          </details>
        )}
    </section>
  );
}
