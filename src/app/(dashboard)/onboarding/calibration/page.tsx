import Link from "next/link";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { CalibrationWizard } from "@/components/onboarding/calibration-wizard";
import { getAuthContext } from "@/lib/supabase/server";
import {
  isOnboardingBlockingForAdmin,
  parseOnboardingCalibration,
} from "@/lib/onboarding/calibration-types";
import {
  clampCalibrationWizardStep,
  parseCalibrationStepQuery,
} from "@/lib/onboarding/calibration-wizard-step";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";

export default async function OnboardingCalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const q = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "admin") redirect("/dashboard");

  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const cal = parseOnboardingCalibration(v6.onboarding_calibration);
  const blocking = isOnboardingBlockingForAdmin({ role: ctx.role, calibration: cal });
  const inProgress = cal?.status === "in_progress";

  if (!blocking && !inProgress) {
    return (
      <div className="ui-page-stack mx-auto max-w-2xl px-4">
        <div className="ui-hero-shell relative overflow-hidden p-7 sm:p-8">
          <div className="flex items-start gap-4">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:color-mix(in_oklab,var(--accent)_24%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_38%,var(--surface-raised))] text-[var(--accent-strong)] shadow-[var(--shadow-1)]"
              aria-hidden
            >
              <Compass className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p>
                <span className="landing-eyebrow-dot text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Calibration
                </span>
              </p>
              {/* v11 spec compliance §Calibration Page: page title mandated
                  as "Set up your contract tracking workspace". Stub-state h1
                  also adopts the spec phrasing (replacing "Workspace
                  calibration") and the spec result message. Full 9-question
                  wizard is handled by CalibrationWizard component below for
                  in-progress/blocking flows. */}
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl">
                Set up your contract tracking workspace
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Your workspace is ready to track contracts. You can run calibration again from product
                settings.
              </p>
              <Link href="/contracts/new" className="ui-link mt-4 inline-block text-sm">
                Upload first contract
              </Link>
              <Link href="/dashboard" className="ui-link ml-3 mt-4 inline-block text-sm">
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const initialRequired = cal?.answers_required ?? {};
  const initialStep = clampCalibrationWizardStep(parseCalibrationStepQuery(q.step), initialRequired);

  return (
    <div className="ui-page-stack px-4 py-2">
      <CalibrationWizard
        initialRequired={initialRequired}
        initialOptional={cal?.answers_optional ?? {}}
        initialStep={initialStep}
      />
    </div>
  );
}
