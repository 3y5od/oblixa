import type { ReactNode } from "react";
import { AsyncActionButton } from "./async-action-button";

export function ConfirmActionButton({
  confirmMessage,
  onConfirm,
  children,
  pendingLabel,
  pending = false,
  ...props
}: Omit<Parameters<typeof AsyncActionButton>[0], "onClick" | "children" | "pendingLabel" | "pending"> & {
  confirmMessage: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  pendingLabel: ReactNode;
  pending?: boolean;
}) {
  return (
    <AsyncActionButton
      {...props}
      pending={pending}
      pendingLabel={pendingLabel}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        void onConfirm();
      }}
    >
      {children}
    </AsyncActionButton>
  );
}