"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { LiveRegion } from "@/components/ui/live-region";
import { UiAlert } from "@/components/ui/ui-alert";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import { SecuritySettingsAccountProtectionCard } from "./security-settings-account-protection-card";
import { useSecuritySettingsPanelController } from "./security-settings-panel-controller";
import { SecuritySettingsDialogs } from "./security-settings-dialogs";
import type { SecuritySettingsPanelProps } from "./security-settings-panel-types";
import { SecuritySettingsSessionsSection } from "./security-settings-sessions-section";
import { SecuritySettingsWorkspaceMfaSection } from "./security-settings-workspace-mfa-section";

export type { SessionRow, TotpFactorRow } from "./security-settings-panel-types";

export function SecuritySettingsPanel(props: SecuritySettingsPanelProps) {
  const controller = useSecuritySettingsPanelController(props);
  const { isOnline } = controller;
  const stepUpIcon = controller.stepUpActive ? (
    <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
  ) : (
    <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
  );

  return (
    <div className="flex flex-col gap-4">
      <LiveRegion message={controller.liveMsg} politeness={controller.error ? "assertive" : "polite"} />
      {!isOnline ? <UiAlert tone="warning">{SETTINGS_SECURITY_STRINGS.offlineCopy}</UiAlert> : null}

      <SecuritySettingsAccountProtectionCard {...controller.accountProtectionProps} stepUpIcon={stepUpIcon} />
      <SecuritySettingsSessionsSection {...controller.sessionsProps} />
      <SecuritySettingsWorkspaceMfaSection {...controller.workspaceMfaProps} />
      <SecuritySettingsDialogs {...controller.dialogsProps} />

      <span className="sr-only">
        {controller.currentAal === "aal2"
          ? "Two-factor sign-in is active for this session."
          : "This session is signed in with a single factor."}
      </span>
    </div>
  );
}
