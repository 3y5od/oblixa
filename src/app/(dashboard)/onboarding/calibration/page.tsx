import Link from "next/link";
import { redirect } from "next/navigation";
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
        <div className="ui-page-shell">
          <p className="ui-eyebrow">Calibration</p>
          <h1 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">Workspace calibration</h1>
          <p className="ui-muted-tight mt-2 text-sm">
            There is no questionnaire to complete right now. You can run calibration again from product
            settings.
          </p>
          <Link href="/settings/product" className="ui-link mt-4 inline-block text-sm">
            Product experience settings
          </Link>
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
