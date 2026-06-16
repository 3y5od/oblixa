import { ADVANCED_NAV_ROLE_OPTIONS } from "@/lib/product-surface/workspace-settings-module-labels";

const HOME_BLOCKS = [
  { key: "control_room_strip", label: "Control room strip (Advanced+)" },
  { key: "telemetry_compact", label: "Signal quality telemetry (Advanced+)" },
  { key: "v6_assurance_snapshot", label: "Assurance snapshot card" },
  { key: "outcome_intelligence", label: "Outcome intelligence block" },
  { key: "assurance_signals", label: "Assurance analytics signals" },
] as const;

export function ModuleChecklist({
  title,
  description,
  namePrefix,
  hidden,
  options,
}: {
  title: string;
  description: string;
  namePrefix: string;
  hidden: Set<string>;
  options: ReadonlyArray<{ key: string; label: string }>;
}) {
  return (
    <div>
      <p className="ui-label-caps">{title}</p>
      <p className="ui-muted-tight mt-1 text-[12.5px]">{description}</p>
      <ul className="mt-3 space-y-2">
        {options.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-2">
            <input
              id={`${namePrefix}_${key}`}
              name={`${namePrefix}_${key}`}
              type="checkbox"
              defaultChecked={hidden.has(key)}
              className="ui-checkbox"
            />
            <label htmlFor={`${namePrefix}_${key}`} className="text-sm text-[var(--text-primary)]">
              Hide {label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdvancedRoleChecklist({ custom, selected }: { custom: boolean; selected: Set<string> }) {
  return (
    <div>
      <CheckboxHeader
        id="customize_advanced_nav_roles"
        title="Customize which roles see advanced primary navigation"
        copy="When Advanced or Assurance mode is on, checked roles below appear in the sidebar for Decisions, Campaigns, Programs, and Relationships. Leave unchecked to use the default (managers, editors, ops, and admins)."
        defaultChecked={custom}
      />
      <RoleList idPrefix="adv_nav" custom={custom} selected={selected} />
      <p className="ui-muted-tight mt-2 text-[12.5px]">
        If customization is enabled but no roles are checked, advanced primary items are hidden for
        everyone except workspace admins (support bypass).
      </p>
    </div>
  );
}

export function AssuranceRoleChecklist({ custom, selected }: { custom: boolean; selected: Set<string> }) {
  return (
    <div>
      <CheckboxHeader
        id="customize_assurance_nav_roles"
        title="Customize which roles see the Assurance navigation section"
        copy="When enabled, checked roles see Findings, Control policies, Scorecards, and the rest of the Assurance subtree. Leave unchecked to use the default (admins, ops managers, and managers)."
        defaultChecked={custom}
      />
      <RoleList idPrefix="asm_nav" custom={custom} selected={selected} itemKeyPrefix="asm" />
      <p className="ui-muted-tight mt-2 text-[12.5px]">
        If customization is enabled but no roles are checked, Assurance nav is limited to workspace
        admins.
      </p>
    </div>
  );
}

function CheckboxHeader({
  id,
  title,
  copy,
  defaultChecked,
}: {
  id: string;
  title: string;
  copy: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <input id={id} name={id} type="checkbox" defaultChecked={defaultChecked} className="ui-checkbox mt-0.5" />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {title}
        </label>
        <p className="ui-muted-tight mt-1 text-[12.5px]">{copy}</p>
      </div>
    </div>
  );
}

function RoleList({
  idPrefix,
  custom,
  selected,
  itemKeyPrefix,
}: {
  idPrefix: string;
  custom: boolean;
  selected: Set<string>;
  itemKeyPrefix?: string;
}) {
  return (
    <ul className="mt-3 space-y-2 pl-6">
      {ADVANCED_NAV_ROLE_OPTIONS.map(({ role, label }) => (
        <li key={itemKeyPrefix ? `${itemKeyPrefix}_${role}` : role} className="flex items-center gap-2">
          <input
            id={`${idPrefix}_${role}`}
            name={`${idPrefix}_${role}`}
            type="checkbox"
            defaultChecked={!custom || selected.has(role)}
            className="ui-checkbox"
          />
          <label htmlFor={`${idPrefix}_${role}`} className="text-sm text-[var(--text-primary)]">
            {label}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function CheckboxSetting({
  id,
  title,
  copy,
  defaultChecked,
}: {
  id: string;
  title: string;
  copy: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <input id={id} name={id} type="checkbox" defaultChecked={defaultChecked} className="ui-checkbox mt-0.5" />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {title}
        </label>
        <p className="ui-muted-tight mt-1 text-[12.5px]">{copy}</p>
      </div>
    </div>
  );
}

export function HomeBlocksChecklist({ hidden }: { hidden: Set<string> }) {
  return (
    <div>
      <p className="ui-label-caps">Home dashboard blocks</p>
      <p className="ui-muted-tight mt-1 text-[12.5px]">
        Hide optional portfolio or assurance strips above the main dashboard (execution metrics
        always stay).
      </p>
      <ul className="mt-3 space-y-2">
        {HOME_BLOCKS.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-2">
            <input
              id={`hide_home_${key}`}
              name={`hide_home_${key}`}
              type="checkbox"
              defaultChecked={hidden.has(key)}
              className="ui-checkbox"
            />
            <label htmlFor={`hide_home_${key}`} className="text-sm text-[var(--text-primary)]">
              Hide {label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DowngradeConfirmation() {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,var(--canvas))] p-4">
      <div className="flex items-start gap-2">
        <input
          id="confirm_scheduled_report_downgrade"
          name="confirm_scheduled_report_downgrade"
          type="checkbox"
          className="ui-checkbox mt-0.5"
        />
        <div>
          <label
            htmlFor="confirm_scheduled_report_downgrade"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Confirm scheduled report suppression on downgrade
          </label>
          <p className="ui-muted-tight mt-1 text-[12.5px]">
            Required only when this change would hide active scheduled report subscriptions.
            Matching subscriptions are deactivated and recorded in audit when the downgrade is
            applied.
          </p>
        </div>
      </div>
    </div>
  );
}
