import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { ActionChip } from "@/components/ui/action-chip";
import { CountChip } from "@/components/ui/count-chip";
import { MetaChip } from "@/components/ui/meta-chip";
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

const MAX_VISIBLE = 6;

export function RecentUploads({ files }: { files: RecentFileRow[] }) {
  if (files.length === 0) {
    return (
      <section>
        <p className="ui-eyebrow">Recent uploads</p>
        <div className="mt-2">
          <DashboardEmptyState
            icon={FileText}
            label="No uploads yet"
            hint="Files appear here after upload"
          />
        </div>
      </section>
    );
  }

  const visible = files.slice(0, MAX_VISIBLE);
  const hasMore = files.length > MAX_VISIBLE;

  return (
    <section>
      <div className="flex items-center gap-1.5">
        <p className="ui-eyebrow">Recent uploads</p>
        {/* Only assert a count when it's the true total; when the capped query
            overflows, the "View all" affordance signals there are more. */}
        {!hasMore ? <CountChip value={files.length} /> : null}
      </div>
      <ul className="mt-2 divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
        {visible.map((f) => (
          <li key={f.id} className="group">
            <Link
              href={`/contracts/${f.contract_id}`}
              title={f.contract_title}
              className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors group-hover:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] group-hover:text-[var(--accent-strong)] group-focus-visible:border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-subtle))] group-focus-visible:text-[var(--accent-strong)]"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-strong)] group-focus-visible:text-[var(--accent-strong)]">
                  {f.contract_title}
                </p>
                <p
                  title={f.file_name}
                  className="flex items-center gap-1.5 text-[10.5px] leading-none text-[var(--text-tertiary)]"
                >
                  <MetaChip>{f.file_type === "application/pdf" ? "PDF" : "DOCX"}</MetaChip>
                  <TimeChip date={f.created_at} format="calendar" />
                </p>
              </div>
              {/* §8.6 hover-revealed structured affordance — slot reserved so rows
                  never shift when the chip fades in. */}
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
      {hasMore ? <ActionChip verb="View all" href="/contracts" className="mt-2.5" /> : null}
    </section>
  );
}
