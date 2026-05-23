import Link from "next/link";
import { FileText, UploadCloud } from "lucide-react";
import { formatRelativeCompact } from "@/lib/ui-copy";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";

interface RecentUploadsTimelineProps {
  orgId: string;
}

export async function RecentUploadsTimeline({ orgId }: RecentUploadsTimelineProps) {
  const admin = await getDashboardAdminClientCached();

  const { data: rows } = await admin
    .from("contracts")
    .select("id, title, counterparty, contract_type, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = (rows ?? []) as Array<{
    id: string;
    title: string;
    counterparty: string | null;
    contract_type: string | null;
    created_at: string;
  }>;

  if (list.length === 0) return null;
  const referenceTimeMs = new Date().getTime();

  return (
    <section className="space-y-3" aria-label="Recent uploads timeline">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <UploadCloud
          className="h-4 w-4 text-[var(--accent-strong)]"
          strokeWidth={1.85}
          aria-hidden
        />
        Recent uploads
      </h2>
      <ol
        className={`gap-3 rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-3.5 ${
          list.length === 1
            ? "flex max-w-xs"
            : list.length === 2
              ? "grid grid-cols-2 max-w-[28rem]"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
        }`.trim()}
      >
        {list.map((c) => {
          const d = new Date(c.created_at);
          const ageMs = referenceTimeMs - d.getTime();
          const isNew = ageMs < 48 * 3600000;
          const isFresh = !isNew && ageMs < 7 * 86400000;
          const ageChip = formatRelativeCompact(d);
          return (
            <li key={c.id} className={list.length === 1 ? "w-full" : ""}>
              <Link
                href={`/contracts/${c.id}`}
                className="group flex h-full flex-col gap-2 rounded-xl border border-[var(--border-card)] bg-[color:color-mix(in_oklab,var(--surface-raised)_92%,white)] p-2.5 transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-strong))] hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent-soft)_42%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))]"
                >
                  <FileText
                    className="h-3.5 w-3.5 text-[var(--accent-strong)]"
                    strokeWidth={1.85}
                  />
                </span>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-semibold leading-snug text-[var(--text-primary)]">
                  <span className="line-clamp-2 leading-snug">{c.title}</span>
                  {isNew ? (
                    <span className="inline-flex h-[18px] items-center rounded-full border border-[color:color-mix(in_oklab,var(--success-ink)_32%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--success-soft)_22%,var(--surface-raised))] px-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] leading-none text-[var(--success-ink)]">
                      NEW
                    </span>
                  ) : isFresh ? (
                    <span className="inline-flex h-[18px] items-center rounded-full border border-[color:color-mix(in_oklab,var(--accent)_22%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--accent-soft)_14%,var(--surface-raised))] px-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] leading-none text-[var(--accent-strong)]">
                      FRESH
                    </span>
                  ) : null}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1">
                  {c.counterparty ? (
                    <span
                      className="inline-flex max-w-full items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] leading-none text-[var(--text-secondary)]"
                      title={c.counterparty}
                    >
                      <span className="truncate">{c.counterparty}</span>
                    </span>
                  ) : null}
                  {c.contract_type ? (
                    <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]">
                      {c.contract_type}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.12em] tabular-nums text-[var(--text-tertiary)]">
                    {ageChip}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
