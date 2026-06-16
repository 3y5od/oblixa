import { Building2, ChevronRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { SettingsCardHeader } from "@/components/settings/settings-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UiToggle } from "@/components/ui/ui-toggle";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";

type SecuritySettingsWorkspaceMfaSectionProps = {
  isAdmin: boolean;
  orgMfaRequired: boolean;
  orgMfa: boolean;
  pending: boolean;
  orgMfaConfirmOpen: boolean;
  cannotEnableOrgMfa: boolean;
  orgMfaHintId: string;
  orgMfaToggleId: string;
  onOrgMfaChange: (checked: boolean) => void;
};

export function SecuritySettingsWorkspaceMfaSection({
  isAdmin,
  orgMfaRequired,
  orgMfa,
  pending,
  orgMfaConfirmOpen,
  cannotEnableOrgMfa,
  orgMfaHintId,
  orgMfaToggleId,
  onOrgMfaChange,
}: SecuritySettingsWorkspaceMfaSectionProps) {
  if (!isAdmin && !orgMfaRequired) return null;

  if (!isAdmin) {
    return (
      <section className="ui-card p-0">
        <SettingsCardHeader
          icon={<Building2 className="h-4 w-4" strokeWidth={1.85} />}
          eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.policy}
          title={SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
        />
        <div className="px-5 py-5">
          <p className="text-[13.5px] text-[var(--text-secondary)]">
            {SETTINGS_SECURITY_STRINGS.workspaceMfaRequiredReadOnly}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="org-mfa-card"
      aria-busy={pending && orgMfaConfirmOpen === false}
      className={`ui-card p-0 ${orgMfa ? "border-[color:color-mix(in_oklab,var(--success-ink)_18%,var(--border-subtle))]" : ""}`}
    >
      <SettingsCardHeader
        icon={<Building2 className="h-4 w-4" strokeWidth={1.85} />}
        eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.policy}
        title={SETTINGS_SECURITY_STRINGS.sections.workspaceMfa}
        badge={
          orgMfa ? (
            <StatusBadge status="healthy" className="gap-1">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              REQUIRED
            </StatusBadge>
          ) : cannotEnableOrgMfa ? (
            <StatusBadge status="warning" className="gap-1 whitespace-nowrap">
              <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden />
              NOT ENABLED
            </StatusBadge>
          ) : (
            <StatusBadge status="empty">OPTIONAL</StatusBadge>
          )
        }
      />
      <div className="px-5 py-5">
        <div className="billing-no-print">
          <UiToggle
            name="org-mfa"
            label="Require MFA for all members"
            description={SETTINGS_SECURITY_STRINGS.orgMfaConsequence}
            checked={orgMfa}
            disabled={pending || cannotEnableOrgMfa}
            ariaLabel="Require MFA for all members"
            ariaDescribedBy={cannotEnableOrgMfa ? orgMfaHintId : undefined}
            onChange={onOrgMfaChange}
          />
          {cannotEnableOrgMfa ? (
            <p id={orgMfaHintId} className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] leading-snug text-[var(--warning-ink)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
              {SETTINGS_SECURITY_STRINGS.orgMfaSelfLockoutHint}
            </p>
          ) : null}
        </div>
        <details className="group mt-3">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-medium text-[var(--accent-strong)] marker:hidden hover:underline [&::-webkit-details-marker]:hidden">
            {SETTINGS_SECURITY_STRINGS.policyExplainerSummary}
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90 motion-reduce:transition-none" strokeWidth={1.85} aria-hidden />
          </summary>
          <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {SETTINGS_SECURITY_STRINGS.policyExplainerBody}
          </p>
        </details>
      </div>
      <span hidden id={orgMfaToggleId} />
    </section>
  );
}
