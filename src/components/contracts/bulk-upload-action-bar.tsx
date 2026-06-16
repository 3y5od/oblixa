import { Loader2 } from "lucide-react";
import { IntakeActionBar } from "@/components/contracts/intake-action-bar";
import type { ImportPath } from "./bulk-upload-form-types";

export function BulkUploadActionBar({
  activePath,
  canSubmit,
  showPrimary,
  barLabel,
  barTone,
  disabledReasonLine,
  isPending,
  submitLabel,
}: {
  activePath: ImportPath;
  canSubmit: boolean;
  showPrimary: boolean;
  barLabel: string;
  barTone: "neutral" | "ready" | "warning";
  disabledReasonLine?: string;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <IntakeActionBar
      state={{ label: barLabel, tone: barTone }}
      disabledReason={disabledReasonLine}
      primary={
        <button
          type="submit"
          disabled={!canSubmit}
          className={
            showPrimary
              ? "ui-btn-primary inline-flex min-h-9 min-w-[10rem] items-center justify-center gap-2 px-4 text-[12.5px] font-semibold"
              : "ui-btn-secondary inline-flex min-h-9 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 px-4 text-[12.5px] font-semibold opacity-70"
          }
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {activePath === "csv" ? "Importing..." : "Uploading..."}
            </>
          ) : (
            submitLabel
          )}
        </button>
      }
    />
  );
}
