import Link from "next/link";
import { IntakeActionBar } from "@/components/contracts/intake-action-bar";

export function UploadFormActionBar({
  actionBarLabel,
  actionBarTone,
  actionBarReason,
  isPending,
  disabled,
  canSubmit,
  pendingLabel,
  submitLabel,
}: {
  actionBarLabel: string;
  actionBarTone: "neutral" | "ready" | "warning";
  actionBarReason?: string;
  isPending: boolean;
  disabled?: boolean;
  canSubmit: boolean;
  pendingLabel: string;
  submitLabel: string;
}) {
  return (
    <IntakeActionBar
      state={{ label: actionBarLabel, tone: actionBarTone }}
      disabledReason={actionBarReason}
      secondary={<Link href="/contracts" className="ui-btn-ghost inline-flex items-center px-4 py-2 text-[13px]">Cancel</Link>}
      primary={
        <button
          type="submit"
          disabled={isPending || disabled || !canSubmit}
          className="ui-btn-primary inline-flex min-w-[11rem] items-center justify-center px-4 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      }
    />
  );
}
