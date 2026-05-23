import { format } from "date-fns";
import Link from "next/link";
import { FileText } from "lucide-react";

export interface RecentFileRow {
  id: string;
  file_name: string;
  file_type: string;
  created_at: string;
  contract_id: string;
  contract_title: string;
}

export function RecentUploads({ files }: { files: RecentFileRow[] }) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_58%,transparent)] px-5 py-6 text-center text-sm text-[var(--text-secondary)] shadow-[var(--shadow-1)] sm:px-6">
        No file uploads yet. PDF and DOCX up to 20 MB are supported.
      </div>
    );
  }

  return (
    <div className="ui-card overflow-hidden">
      {/* v23 aesthetic pass: dropped the explainer paragraph ("Latest
          files attached to contracts in your workspace. Choose a contract
          to run extraction or continue review.") — the eyebrow + h2 are
          unambiguous; the description repeated what's clearly a recent-
          activity list (§10.4 + §10.7). */}
      <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <p className="ui-eyebrow">Activity</p>
        <h2 className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">Recent uploads</h2>
      </div>
      <ul className="max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto">
        {files.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-contrast)_72%,transparent)]">
              <FileText size={16} className="text-[var(--text-tertiary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {f.file_name}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                <Link
                  href={`/contracts/${f.contract_id}`}
                  className="ui-link text-xs"
                >
                  {f.contract_title}
                </Link>
                {" · "}
                {f.file_type === "application/pdf" ? "PDF" : "DOCX"}
                {" · "}
                {format(new Date(f.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
