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
      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-zinc-50/50 px-5 py-5 text-center text-sm text-zinc-500 sm:px-6">
        No file uploads yet. PDF and DOCX up to 20 MB are supported.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-surface shadow-[var(--shadow-1)]">
      <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold text-zinc-900">Recent uploads</h2>
        <p className="text-xs text-zinc-500">
          Latest files attached to contracts in your workspace. Open a contract to run
          extraction or continue review.
        </p>
      </div>
      <ul className="max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto">
        {files.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
            <FileText size={18} className="mt-0.5 shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">
                {f.file_name}
              </p>
              <p className="text-xs text-zinc-500">
                <Link
                  href={`/contracts/${f.contract_id}`}
                  className="ui-link text-sm"
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
