import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { CountChip } from "@/components/ui/count-chip";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { TimeChip } from "@/components/ui/time-chip";

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
      <section>
        <p className="ui-eyebrow">Recent uploads</p>
        <div className="mt-2">
          <DashboardEmptyState icon={FileText} label="No uploads yet" hint="Shown after upload" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-1.5">
        <p className="ui-eyebrow">Recent uploads</p>
        <CountChip value={files.length} />
      </div>
      <ul className="mt-2 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {files.map((f) => (
          <li key={f.id} className="group">
            <Link
              href={`/contracts/${f.contract_id}`}
              title={f.contract_title}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span
                aria-hidden
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors group-hover:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] group-hover:text-[var(--accent-strong)] group-focus-visible:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] group-focus-visible:text-[var(--accent-strong)]"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-strong)] group-focus-visible:text-[var(--accent-strong)]">
                  {f.contract_title}
                </p>
                <p
                  title={f.file_name}
                  className="flex items-center truncate text-[10.5px] text-[var(--text-tertiary)]"
                >
                  <span className="font-mono uppercase tracking-[0.12em]">
                    {f.file_type === "application/pdf" ? "PDF" : "DOCX"}
                  </span>
                  <span className="ui-dot-sep">·</span>
                  <TimeChip date={f.created_at} format="calendar" />
                </p>
              </div>
              <span
                aria-hidden
                className="ui-caps-2 inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-card)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9.5px] leading-none text-[var(--accent-strong)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Open
                <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
