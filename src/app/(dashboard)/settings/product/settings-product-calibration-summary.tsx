import type { OnboardingCalibrationState } from "@/lib/onboarding/calibration-types";
import {
  calibrationHistoryChoiceLabels,
  formatSetupChecklistSummary,
  labelForSearchScope,
  modeLabels,
  settingsCalibrationMarkers,
} from "@/lib/onboarding/calibration-copy";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";

function labelAdvanced(key: string): string {
  return WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function labelAssurance(key: string): string {
  return WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function labelUtility(key: string): string {
  return WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function SettingsProductCalibrationSummary({
  cal,
}: {
  cal: OnboardingCalibrationState;
}) {
  const history = [...(cal.history ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const applied = cal.last_applied;
  const rec = cal.last_recommendation;

  return (
    <div className="mt-4 space-y-3">
      {history.length > 0 ? (
        <details
          className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/30 p-3"
          data-testid={settingsCalibrationMarkers.historyDetails}
        >
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
            Calibration history ({history.length})
          </summary>
          <ul className="ui-muted-tight mt-3 space-y-2 text-[12px] text-[var(--text-secondary)]">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0">
                <span className="font-medium text-[var(--text-primary)]">
                  {new Date(h.at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {" · "}
                {calibrationHistoryChoiceLabels[h.choice]}
                {" · "}
                {modeLabels[h.prior_mode]} → {modeLabels[h.next_mode]}
                <span className="block text-[11px] text-[var(--text-tertiary)]">
                  Actor: {h.actor_user_id.slice(0, 8)}…
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {applied ? (
        <details
          className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/30 p-3"
          data-testid={settingsCalibrationMarkers.lastAppliedDetails}
        >
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
            Last applied configuration
          </summary>
          <dl className="ui-muted-tight mt-3 space-y-2 text-[12px] text-[var(--text-secondary)]">
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Workspace mode</dt>
              <dd>{modeLabels[applied.applied_workspace_mode]}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Default landing</dt>
              <dd>{applied.default_landing_path ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Search scope</dt>
              <dd>{labelForSearchScope(applied.search_scope)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Advanced modules hidden</dt>
              <dd>
                {applied.advanced_modules_hidden.length === 0
                  ? "None"
                  : applied.advanced_modules_hidden.map(labelAdvanced).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Assurance modules hidden</dt>
              <dd>
                {applied.assurance_modules_hidden.length === 0
                  ? "None"
                  : applied.assurance_modules_hidden.map(labelAssurance).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Utility modules hidden</dt>
              <dd>
                {!applied.utility_modules_hidden?.length
                  ? "None listed"
                  : applied.utility_modules_hidden.map(labelUtility).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Home sections hidden</dt>
              <dd>
                {applied.home_hidden_sections.length === 0
                  ? "None"
                  : applied.home_hidden_sections.join(", ")}
              </dd>
            </div>
          </dl>
        </details>
      ) : null}

      {rec ? (
        <details
          className="rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,var(--canvas))]/30 p-3"
          data-testid={settingsCalibrationMarkers.lastRecommendationDetails}
        >
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
            Last generated recommendation (read-only)
          </summary>
          <dl className="ui-muted-tight mt-3 space-y-2 text-[12px] text-[var(--text-secondary)]">
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Recommended mode</dt>
              <dd>{modeLabels[rec.recommended_workspace_mode]}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Suggested first steps</dt>
              <dd>{formatSetupChecklistSummary(rec.recommended_setup_checklist)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Search scope</dt>
              <dd>{labelForSearchScope(rec.recommended_search_scope)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">Default landing</dt>
              <dd>{rec.recommended_default_landing_path}</dd>
            </div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}
