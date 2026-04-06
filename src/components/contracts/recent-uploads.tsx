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
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-sm text-zinc-500">
        No file uploads yet. PDF and DOCX up to 20 MB are supported.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Recent uploads</h2>
        <p className="text-xs text-zinc-500">
          Latest files stored for your organization. Status: stored in Supabase
          (ready for extraction after contract is saved).
        </p>
      </div>
      <ul className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
        {files.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-4 py-3">
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
