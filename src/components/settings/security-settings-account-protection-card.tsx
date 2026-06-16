import type { ComponentProps } from "react";
import { ShieldCheck } from "lucide-react";
import { KeyValueChip } from "@/components/ui/key-value-chip";
import { SettingsCardHeader } from "@/components/settings/settings-card";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { SecuritySettingsMfaColumn } from "./security-settings-mfa-column";
import { SecuritySettingsStepUpColumn } from "./security-settings-step-up-column";

type SecuritySettingsAccountProtectionCardProps = ComponentProps<typeof SecuritySettingsMfaColumn> &
  ComponentProps<typeof SecuritySettingsStepUpColumn>;

export function SecuritySettingsAccountProtectionCard(props: SecuritySettingsAccountProtectionCardProps) {
  const factorCount = props.factors.length;
  const showEnrolledCount = factorCount > 0;

  return (
    <section
      id="account-protection-card"
      className="ui-card-raised p-0"
      aria-busy={props.pending && (props.enroll != null || props.pendingFactorId != null)}
    >
      <SettingsCardHeader
        icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.85} />}
        eyebrow={SETTINGS_SECURITY_STRINGS.eyebrows.protection}
        title={SETTINGS_SECURITY_STRINGS.sections.protection}
        badge={showEnrolledCount ? <KeyValueChip label="ENROLLED" value={factorCount} tone="success" /> : null}
      />

      <div className="grid divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_62%,transparent)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <SecuritySettingsMfaColumn {...props} />
        <SecuritySettingsStepUpColumn {...props} />
      </div>
    </section>
  );
}
