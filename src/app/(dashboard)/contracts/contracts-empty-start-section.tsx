import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { surfaceTestIds } from "@/lib/qa/test-ids";

export function ContractsEmptyStartSection({ canEdit }: { canEdit: boolean }) {
  return (
    <section
      data-testid={surfaceTestIds.contractsPageSnapshot}
      className="ui-card-raised flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6"
    >
      <div className="min-w-0">
        <p className="ui-caps-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="landing-eyebrow-dot" aria-hidden />
          Get started
        </p>
        <p className="mt-2 text-[14px] font-semibold text-[var(--text-primary)]">
          No contracts in this workspace yet
        </p>
        <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {canEdit
            ? "Upload a signed agreement or import your tracker. Oblixa suggests dates, owners, and terms from the document for you to confirm."
            : "An owner or admin uploads signed agreements here. Once contracts are added, you can review owners, dates, tasks, and evidence."}
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
          Files are workspace-scoped. Oblixa may use document text to suggest contract details, but suggestions are not
          trusted until someone confirms them.
        </p>
      </div>
      {canEdit ? (
        <Link
          href="/contracts/new"
          className="ui-btn-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
        >
          <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
          Upload contract
        </Link>
      ) : null}
    </section>
  );
}
