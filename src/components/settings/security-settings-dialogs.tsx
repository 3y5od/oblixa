import { UiConfirmDialog } from "@/components/ui/ui-confirm-dialog";
import { SETTINGS_SECURITY_STRINGS } from "@/lib/settings/spec-strings";
import type { RemoveConfirmState } from "./security-settings-panel-types";

type SecuritySettingsDialogsProps = {
  signOutConfirmOpen: boolean;
  removeConfirm: RemoveConfirmState;
  orgMfaConfirmOpen: boolean;
  onCloseSignOut: () => void;
  onCloseRemove: () => void;
  onCloseOrgMfa: () => void;
  onConfirmSignOut: () => Promise<void>;
  onConfirmRemove: () => Promise<void>;
  onConfirmOrgMfa: () => Promise<void>;
};

export function SecuritySettingsDialogs({
  signOutConfirmOpen,
  removeConfirm,
  orgMfaConfirmOpen,
  onCloseSignOut,
  onCloseRemove,
  onCloseOrgMfa,
  onConfirmSignOut,
  onConfirmRemove,
  onConfirmOrgMfa,
}: SecuritySettingsDialogsProps) {
  return (
    <>
      <UiConfirmDialog
        open={signOutConfirmOpen}
        onClose={onCloseSignOut}
        title="Sign out all other devices?"
        description="Every other signed-in session ends immediately. Each device must sign in again."
        destructive
        confirmLabel="Sign out others"
        onConfirm={onConfirmSignOut}
      />

      <UiConfirmDialog
        open={!!removeConfirm}
        onClose={onCloseRemove}
        title="Remove this authenticator?"
        description="You can re-enroll at any time."
        destructive
        confirmLabel="Remove"
        onConfirm={onConfirmRemove}
      />

      <UiConfirmDialog
        open={orgMfaConfirmOpen}
        onClose={onCloseOrgMfa}
        title="Require MFA for all workspace members?"
        description={SETTINGS_SECURITY_STRINGS.orgMfaConsequence}
        confirmLabel="Require MFA"
        onConfirm={onConfirmOrgMfa}
      />
    </>
  );
}
