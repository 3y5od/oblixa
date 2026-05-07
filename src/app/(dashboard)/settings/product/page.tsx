import Link from "next/link";
import { getAuthContext } from "@/lib/supabase/server";
import { WorkspaceRequiredState } from "@/components/layout/workspace-required-state";
import { getV6OrgSettingsJson } from "@/lib/v6/org-settings";
import {
  resetWorkspaceProductSurfaceDefaultsForm,
  updateWorkspaceProductSurfaceForm,
} from "@/actions/product-surface-settings";
import { createHash } from "node:crypto";
import { startRecalibrationFromSettingsForm } from "@/actions/onboarding-calibration";
import { parseOnboardingCalibration } from "@/lib/onboarding/calibration-types";
import { getFeatureFlags } from "@/lib/feature-flags";
import {
  ADVANCED_NAV_ROLE_OPTIONS,
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";
import { SettingsProductDraftPreview } from "@/app/(dashboard)/settings/product/settings-product-draft-preview";
import { SettingsProductCalibrationExport } from "@/app/(dashboard)/settings/product/settings-product-calibration-export";
import { SettingsProductCalibrationSummary } from "@/app/(dashboard)/settings/product/settings-product-calibration-summary";
import { SettingsProductEmailSection } from "@/app/(dashboard)/settings/product/settings-product-email-section";
import { V10RecoverableState } from "@/components/ui/v10-recoverable-state";

const MODULE_OPTIONS = WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS;
const ASSURANCE_MODULE_OPTIONS = WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS;
const UTILITY_MODULE_OPTIONS = WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS;

export const metadata = { title: "Product experience" };

export default async function WorkspaceProductSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) return <WorkspaceRequiredState />;
  if (ctx.role !== "admin") {
    return (
      <div className="ui-page-stack mx-auto max-w-2xl">
        <V10RecoverableState
          state="forbidden"
          title="Only workspace admins can change product mode"
          reason="Your current role can view settings but cannot change workspace mode, module visibility, or notification category controls."
          accessibleName="Product experience settings forbidden state"
          surface="settings_product"
          section="authorization"
          sourceObject="setting"
          nextActionLabel="Back to settings"
          nextAction={
            <Link href="/settings" className="ui-link inline-block text-sm">
              Back to settings
            </Link>
          }
        />
      </div>
    );
  }

  const v6 = await getV6OrgSettingsJson(ctx.admin, ctx.orgId);
  const onboardingCal = parseOnboardingCalibration(v6.onboarding_calibration);
  const hidden = new Set(v6.advanced_modules_hidden ?? []);
  const assuranceHidden = new Set(v6.assurance_modules_hidden ?? []);
  const utilityHidden = new Set(v6.utility_modules_hidden ?? []);
  const homeHidden = new Set(v6.home_hidden_sections ?? []);
  const mode = v6.workspace_mode ?? "core";
  const advancedNavCustom = Array.isArray(v6.advanced_nav_roles);
  const advancedNavSet = new Set(v6.advanced_nav_roles ?? []);
  const assuranceNavCustom = Array.isArray(v6.assurance_nav_roles);
  const assuranceNavSet = new Set(v6.assurance_nav_roles ?? []);

  const { data: workflowRow } = await ctx.admin
    .from("organization_workflow_settings")
    .select("notification_policy_json")
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  const emailPolicy = (
    (workflowRow?.notification_policy_json as Record<string, unknown> | null)?.email ?? {}
  ) as Record<string, unknown>;
  const emailBlocked = new Set(
    Array.isArray(emailPolicy.blocked_types)
      ? (emailPolicy.blocked_types as unknown[]).map((v) => String(v))
      : []
  );
  const featureFlags = getFeatureFlags();
  const orgFingerprint = createHash("sha256").update(ctx.orgId).digest("hex").slice(0, 8);

  return (
    <div className="ui-page-stack mx-auto max-w-2xl">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Workspace</p>
          <h1 className="ui-display-title mt-2">Product experience</h1>
          <p className="ui-page-lead mt-3 max-w-2xl">
            Control how much of the platform appears in navigation and the home dashboard for this
            workspace.
          </p>
        </div>
        <details className="mt-4 max-w-2xl rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
            What each mode changes
          </summary>
          <div className="ui-muted-tight mt-3 space-y-3 text-[13px] text-[var(--text-secondary)]">
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
      </header>

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
        <p className="ui-support-copy mt-2 text-[12px]">
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

      <section className="ui-page-shell p-6 md:p-8">
        <form
          id="workspace-product-settings-form"
          action={updateWorkspaceProductSurfaceForm as never}
          className="space-y-6"
        >
          <div>
            <label htmlFor="workspace_mode" className="ui-label-caps">
              Workspace mode
            </label>
            <select
              id="workspace_mode"
              name="workspace_mode"
              defaultValue={mode}
              className="ui-input mt-2 w-full max-w-md"
            >
              <option value="core">Core — execution workspace only</option>
              <option value="advanced">Advanced — programs, decisions, campaigns, relationships</option>
              <option value="assurance">Assurance — full adaptive and assurance surfaces</option>
            </select>
            <p className="ui-muted-tight mt-2 text-[13px]">
              New workspaces default to Core. Assurance mode is required for mutating autopilot
              execution.
            </p>
            <p className="ui-muted-tight mt-2 text-[13px]">
              Workspace mode controls navigation and product experience, not billing. If a downgrade
              would hide active scheduled report subscriptions, confirm that suppression below before
              saving.
            </p>
          </div>

          <div>
            <p className="ui-label-caps">Hide advanced modules</p>
            <p className="ui-muted-tight mt-1 text-[13px]">
              When the workspace is Advanced or Assurance, uncheck modules you do not want in primary
              navigation.
            </p>
            <ul className="mt-3 space-y-2">
              {MODULE_OPTIONS.map(({ key, label }) => (
                <li key={key} className="flex items-center gap-2">
                  <input
                    id={`hide_${key}`}
                    name={`hide_${key}`}
                    type="checkbox"
                    defaultChecked={hidden.has(key)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <label htmlFor={`hide_${key}`} className="text-sm text-[var(--text-primary)]">
                    Hide {label}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-start gap-2">
              <input
                id="customize_advanced_nav_roles"
                name="customize_advanced_nav_roles"
                type="checkbox"
                defaultChecked={advancedNavCustom}
                className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
              />
              <div>
                <label
                  htmlFor="customize_advanced_nav_roles"
                  className="text-sm font-medium text-[var(--text-primary)]"
                >
                  Customize which roles see advanced primary navigation
                </label>
                <p className="ui-muted-tight mt-1 text-[13px]">
                  When Advanced or Assurance mode is on, checked roles below appear in the sidebar for Decisions,
                  Campaigns, Programs, and Relationships. Leave unchecked to use the default (managers, editors,
                  ops, and admins).
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2 pl-6">
              {ADVANCED_NAV_ROLE_OPTIONS.map(({ role, label }) => (
                <li key={role} className="flex items-center gap-2">
                  <input
                    id={`adv_nav_${role}`}
                    name={`adv_nav_${role}`}
                    type="checkbox"
                    defaultChecked={!advancedNavCustom || advancedNavSet.has(role)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <label htmlFor={`adv_nav_${role}`} className="text-sm text-[var(--text-primary)]">
                    {label}
                  </label>
                </li>
              ))}
            </ul>
            <p className="ui-muted-tight mt-2 text-[12px]">
              If customization is enabled but no roles are checked, advanced primary items are hidden for everyone
              except workspace admins (support bypass).
            </p>
          </div>

          {mode === "assurance" ? (
            <div>
              <div className="flex items-start gap-2">
                <input
                  id="customize_assurance_nav_roles"
                  name="customize_assurance_nav_roles"
                  type="checkbox"
                  defaultChecked={assuranceNavCustom}
                  className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
                />
                <div>
                  <label
                    htmlFor="customize_assurance_nav_roles"
                    className="text-sm font-medium text-[var(--text-primary)]"
                  >
                    Customize which roles see the Assurance navigation section
                  </label>
                  <p className="ui-muted-tight mt-1 text-[13px]">
                    When enabled, checked roles see Findings, Control policies, Scorecards, and the rest of the
                    Assurance subtree. Leave unchecked to use the default (admins, ops managers, and managers).
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-2 pl-6">
                {ADVANCED_NAV_ROLE_OPTIONS.map(({ role, label }) => (
                  <li key={`asm_${role}`} className="flex items-center gap-2">
                    <input
                      id={`asm_nav_${role}`}
                      name={`asm_nav_${role}`}
                      type="checkbox"
                      defaultChecked={!assuranceNavCustom || assuranceNavSet.has(role)}
                      className="h-4 w-4 rounded border-[var(--border-strong)]"
                    />
                    <label htmlFor={`asm_nav_${role}`} className="text-sm text-[var(--text-primary)]">
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="ui-muted-tight mt-2 text-[12px]">
                If customization is enabled but no roles are checked, Assurance nav is limited to workspace admins.
              </p>
            </div>
          ) : null}

          <div>
            <p className="ui-label-caps">Hide tool modules</p>
            <p className="ui-muted-tight mt-1 text-[13px]">
              Hide tool entry points from contextual nav and the tools index.
            </p>
            <ul className="mt-3 space-y-2">
              {UTILITY_MODULE_OPTIONS.map(({ key, label }) => (
                <li key={key} className="flex items-center gap-2">
                  <input
                    id={`hide_utility_${key}`}
                    name={`hide_utility_${key}`}
                    type="checkbox"
                    defaultChecked={utilityHidden.has(key)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <label htmlFor={`hide_utility_${key}`} className="text-sm text-[var(--text-primary)]">
                    Hide {label}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {mode === "assurance" ? (
            <div>
              <p className="ui-label-caps">Hide assurance modules</p>
              <p className="ui-muted-tight mt-1 text-[13px]">
                Keep the Assurance section available while hiding specific assurance module families.
              </p>
              <ul className="mt-3 space-y-2">
                {ASSURANCE_MODULE_OPTIONS.map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2">
                    <input
                      id={`hide_assurance_${key}`}
                      name={`hide_assurance_${key}`}
                      type="checkbox"
                      defaultChecked={assuranceHidden.has(key)}
                      className="h-4 w-4 rounded border-[var(--border-strong)]"
                    />
                    <label htmlFor={`hide_assurance_${key}`} className="text-sm text-[var(--text-primary)]">
                      Hide {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <label htmlFor="search_scope" className="ui-label-caps">
              Search scope
            </label>
            <select
              id="search_scope"
              name="search_scope"
              defaultValue={v6.search_scope === "core_only" ? "core_only" : "match_mode"}
              className="ui-input mt-2 w-full max-w-md"
            >
              <option value="match_mode">Match workspace mode visibility</option>
              <option value="core_only">Core-only discoverability</option>
            </select>
            <p className="ui-muted-tight mt-2 text-[13px]">
              Applies to global discoverability surfaces such as command palette recents and future
              global search indexing.
            </p>
          </div>

          <div>
            <label htmlFor="default_landing_path" className="ui-label-caps">
              Default landing path (optional)
            </label>
            <input
              id="default_landing_path"
              name="default_landing_path"
              type="text"
              defaultValue={v6.default_landing_path ?? ""}
              placeholder="/dashboard"
              className="ui-input mt-2 w-full max-w-md font-mono text-sm"
            />
            <p className="ui-muted-tight mt-2 text-[13px]">
              Must start with <code className="text-xs">/</code>, match the workspace mode (Core cannot use Advanced
              or Assurance routes or command-palette shortcuts as the org default), and stay open-redirect safe. Leave
              blank to keep the default.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="assurance_nav_admin_testing"
              name="assurance_nav_admin_testing"
              type="checkbox"
              defaultChecked={v6.assurance_nav_admin_testing === true}
              className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
            />
            <div>
              <label htmlFor="assurance_nav_admin_testing" className="text-sm font-medium text-[var(--text-primary)]">
                Admin testing: show Assurance navigation outside Assurance mode
              </label>
              <p className="ui-muted-tight mt-1 text-[13px]">
                For support only. Routes still require Assurance mode unless you are an admin.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="autopilot_allow_execution"
              name="autopilot_allow_execution"
              type="checkbox"
              defaultChecked={v6.autopilot_allow_execution === true}
              className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
            />
            <div>
              <label htmlFor="autopilot_allow_execution" className="text-sm font-medium text-[var(--text-primary)]">
                Allow mutating autopilot execution (Assurance workspaces only)
              </label>
              <p className="ui-muted-tight mt-1 text-[13px]">
                When off, autopilot stays in dry-run style paths. Requires Assurance mode to take
                effect.
              </p>
            </div>
          </div>

          <div>
            <p className="ui-label-caps">Home dashboard blocks</p>
            <p className="ui-muted-tight mt-1 text-[13px]">
              Hide optional portfolio or assurance strips above the main dashboard (execution metrics always stay).
            </p>
            <ul className="mt-3 space-y-2">
              {[
                { key: "control_room_strip", label: "Control room strip (Advanced+)" },
                { key: "telemetry_compact", label: "Signal quality telemetry (Advanced+)" },
                { key: "v6_assurance_snapshot", label: "Assurance snapshot card" },
                { key: "outcome_intelligence", label: "Outcome intelligence block" },
                { key: "assurance_signals", label: "Assurance analytics signals" },
              ].map(({ key, label }) => (
                <li key={key} className="flex items-center gap-2">
                  <input
                    id={`hide_home_${key}`}
                    name={`hide_home_${key}`}
                    type="checkbox"
                    defaultChecked={homeHidden.has(key)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <label htmlFor={`hide_home_${key}`} className="text-sm text-[var(--text-primary)]">
                    Hide {label}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,var(--canvas))] p-4">
            <div className="flex items-start gap-2">
              <input
                id="confirm_scheduled_report_downgrade"
                name="confirm_scheduled_report_downgrade"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--border-strong)]"
              />
              <div>
                <label
                  htmlFor="confirm_scheduled_report_downgrade"
                  className="text-sm font-medium text-[var(--text-primary)]"
                >
                  Confirm scheduled report suppression on downgrade
                </label>
                <p className="ui-muted-tight mt-1 text-[13px]">
                  Required only when this change would hide active scheduled report subscriptions.
                  Matching subscriptions are deactivated and recorded in audit when the downgrade is
                  applied.
                </p>
              </div>
            </div>
          </div>

          <button type="submit" className="ui-btn-primary px-4 py-2 text-[13px]">
            Save product settings
          </button>
        </form>
        <form action={resetWorkspaceProductSurfaceDefaultsForm as never} className="mt-4">
          <button type="submit" className="ui-btn-secondary px-4 py-2 text-[13px]">
            Reset to workspace defaults
          </button>
        </form>
      </section>

      <SettingsProductDraftPreview
        formId="workspace-product-settings-form"
        orgId={ctx.orgId}
        featureFlags={featureFlags}
        initialBlockedTypes={[...emailBlocked]}
        initialMode={mode}
      />

      <SettingsProductEmailSection blockedTypes={[...emailBlocked]} />
    </div>
  );
}
