import { UiSelect } from "@/components/ui/ui-select";
import {
  resetWorkspaceProductSurfaceDefaultsForm,
  updateWorkspaceProductSurfaceForm,
} from "@/actions/product-surface-settings";
import {
  WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS,
  WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS,
} from "@/lib/product-surface/workspace-settings-module-labels";
import {
  AdvancedRoleChecklist,
  AssuranceRoleChecklist,
  CheckboxSetting,
  DowngradeConfirmation,
  HomeBlocksChecklist,
  ModuleChecklist,
} from "@/app/(dashboard)/settings/product/settings-product-surface-form-parts";

const MODULE_OPTIONS = WORKSPACE_SETTINGS_ADVANCED_MODULE_OPTIONS;
const ASSURANCE_MODULE_OPTIONS = WORKSPACE_SETTINGS_ASSURANCE_MODULE_OPTIONS;
const UTILITY_MODULE_OPTIONS = WORKSPACE_SETTINGS_UTILITY_MODULE_OPTIONS;

export function ProductSurfaceSettingsForm({
  mode,
  hidden,
  assuranceHidden,
  utilityHidden,
  homeHidden,
  advancedNavCustom,
  advancedNavSet,
  assuranceNavCustom,
  assuranceNavSet,
  searchScope,
  defaultLandingPath,
  assuranceNavAdminTesting,
  autopilotAllowExecution,
}: {
  mode: string;
  hidden: Set<string>;
  assuranceHidden: Set<string>;
  utilityHidden: Set<string>;
  homeHidden: Set<string>;
  advancedNavCustom: boolean;
  advancedNavSet: Set<string>;
  assuranceNavCustom: boolean;
  assuranceNavSet: Set<string>;
  searchScope?: string | null;
  defaultLandingPath?: string | null;
  assuranceNavAdminTesting?: boolean;
  autopilotAllowExecution?: boolean;
}) {
  return (
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
          <UiSelect
            id="workspace_mode"
            name="workspace_mode"
            defaultValue={mode}
            options={[
              { value: "core", label: "Core — execution workspace only" },
              { value: "advanced", label: "Advanced — programs, decisions, campaigns, relationships" },
              { value: "assurance", label: "Assurance — full adaptive and assurance surfaces" },
            ]}
            variant="compact"
            portal
            className="mt-2 w-full max-w-md"
            buttonClassName="w-full !min-h-11"
          />
          <p className="ui-muted-tight mt-2 text-[12.5px]">
            New workspaces default to Core. Assurance mode is required for mutating autopilot
            execution.
          </p>
          <p className="ui-muted-tight mt-2 text-[12.5px]">
            Workspace mode controls navigation and product experience, not billing. If a downgrade
            would hide active scheduled report subscriptions, confirm that suppression below before
            saving.
          </p>
        </div>
        <ModuleChecklist
          title="Hide advanced modules"
          description="When the workspace is Advanced or Assurance, uncheck modules you do not want in primary navigation."
          namePrefix="hide"
          hidden={hidden}
          options={MODULE_OPTIONS}
        />
        <AdvancedRoleChecklist custom={advancedNavCustom} selected={advancedNavSet} />
        {mode === "assurance" ? (
          <AssuranceRoleChecklist custom={assuranceNavCustom} selected={assuranceNavSet} />
        ) : null}
        <ModuleChecklist
          title="Hide tool modules"
          description="Hide tool entry points from contextual nav and the tools index."
          namePrefix="hide_utility"
          hidden={utilityHidden}
          options={UTILITY_MODULE_OPTIONS}
        />
        {mode === "assurance" ? (
          <ModuleChecklist
            title="Hide assurance modules"
            description="Keep the Assurance section available while hiding specific assurance module families."
            namePrefix="hide_assurance"
            hidden={assuranceHidden}
            options={ASSURANCE_MODULE_OPTIONS}
          />
        ) : null}
        <SearchScopeField searchScope={searchScope} />
        <DefaultLandingPathField defaultLandingPath={defaultLandingPath} />
        <CheckboxSetting
          id="assurance_nav_admin_testing"
          title="Admin testing: show Assurance navigation outside Assurance mode"
          copy="For support only. Routes still require Assurance mode unless you are an admin."
          defaultChecked={assuranceNavAdminTesting === true}
        />
        <CheckboxSetting
          id="autopilot_allow_execution"
          title="Allow mutating autopilot execution (Assurance workspaces only)"
          copy="When off, autopilot stays in dry-run style paths. Requires Assurance mode to take effect."
          defaultChecked={autopilotAllowExecution === true}
        />
        <HomeBlocksChecklist hidden={homeHidden} />
        <DowngradeConfirmation />
        <button type="submit" className="ui-btn-primary px-4 py-2 text-[12.5px]">
          Save product settings
        </button>
      </form>
      <form action={resetWorkspaceProductSurfaceDefaultsForm as never} className="mt-4">
        <button type="submit" className="ui-btn-secondary px-4 py-2 text-[12.5px]">
          Reset to workspace defaults
        </button>
      </form>
    </section>
  );
}

function SearchScopeField({ searchScope }: { searchScope?: string | null }) {
  return (
    <div>
      <label htmlFor="search_scope" className="ui-label-caps">
        Search scope
      </label>
      <UiSelect
        id="search_scope"
        name="search_scope"
        defaultValue={searchScope === "core_only" ? "core_only" : "match_mode"}
        options={[
          { value: "match_mode", label: "Match workspace mode visibility" },
          { value: "core_only", label: "Core-only discoverability" },
        ]}
        variant="compact"
        portal
        className="mt-2 w-full max-w-md"
        buttonClassName="w-full !min-h-11"
      />
      <p className="ui-muted-tight mt-2 text-[12.5px]">
        Applies to global discoverability surfaces such as command palette recents and future
        global search indexing.
      </p>
    </div>
  );
}

function DefaultLandingPathField({ defaultLandingPath }: { defaultLandingPath?: string | null }) {
  return (
    <div>
      <label htmlFor="default_landing_path" className="ui-label-caps">
        Default landing path (optional)
      </label>
      <input
        aria-label="/dashboard"
        id="default_landing_path"
        name="default_landing_path"
        type="text"
        defaultValue={defaultLandingPath ?? ""}
        placeholder="/dashboard"
        className="ui-input mt-2 w-full max-w-md font-mono text-sm"
      />
      <p className="ui-muted-tight mt-2 text-[12.5px]">
        Must start with <code className="text-xs">/</code>, match the workspace mode (Core cannot
        use Advanced or Assurance routes or command-palette shortcuts as the org default), and stay
        open-redirect safe. Leave blank to keep the default.
      </p>
    </div>
  );
}
