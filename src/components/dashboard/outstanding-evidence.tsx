import Link from "next/link";
import { differenceInDays, isValid } from "date-fns";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { formatCalendarCompact } from "@/lib/ui-copy";
import { getDashboardAdminClientCached } from "@/lib/dashboard-data";

interface OutstandingEvidenceProps {
  orgId: string;
}

export async function OutstandingEvidence({ orgId }: OutstandingEvidenceProps) {
  const admin = await getDashboardAdminClientCached();

  const { data: rows } = await admin
    .from("evidence_requirements")
    .select("id, contract_id, title, status, due_at, contracts(id, title, counterparty)")
    .eq("organization_id", orgId)
    .eq("status", "required")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(20);

  const list = (rows ?? []) as Array<{
    id: string;
    contract_id: string;
    title: string;
    status: string;
    due_at: string | null;
    contracts: { id: string; title: string; counterparty: string | null } | Array<{ id: string; title: string; counterparty: string | null }> | null;
  }>;

  if (list.length === 0) return null;

  type Row = {
    id: string;
    title: string;
    contractId: string;
    contractTitle: string;
    counterparty: string | null;
    dueAt: string | null;
    daysUntil: number | null;
  };

  const items: Row[] = list.flatMap((row) => {
    const rel = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
    if (!rel) return [];
    const due = row.due_at;
    const daysUntil = (() => {
      if (!due) return null;
      const d = new Date(due);
      if (!isValid(d)) return null;
      return differenceInDays(d, new Date());
    })();
    return [
      {
        id: row.id,
        title: row.title,
        contractId: rel.id,
        contractTitle: rel.title,
        counterparty: rel.counterparty,
        dueAt: due,
        daysUntil,
      },
    ];
  });

  if (items.length === 0) return null;

  // Show top 5 — earliest due first (nulls already at end via query).
  const visible = items.slice(0, 5);

  return (
    <section className="space-y-3" aria-label="Outstanding evidence">
      <h2 className="inline-flex items-center gap-2 text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)]">
        <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" strokeWidth={1.85} aria-hidden />
        Outstanding evidence
      </h2>
      <div className="rounded-2xl border border-[var(--border-card)] bg-[var(--surface-raised)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_oklab,var(--warning-ink)_28%,var(--border-card))] bg-[color:color-mix(in_oklab,var(--warning-soft)_18%,var(--surface-raised))] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none text-[var(--warning-ink)]">
            <span className="tabular-nums">{items.length}</span>
            <span>AWAITING</span>
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            EVIDENCE
          </span>
        </div>
        <ul className="divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
          {visible.map((it) => {
            const tone =
              it.daysUntil == null
                ? "neutral"
                : it.daysUntil < 0
                  ? "danger"
                  : it.daysUntil <= 7
                    ? "warning"
                    : "neutral";
            const toneInk =
              tone === "danger"
                ? "var(--danger-ink)"
                : tone === "warning"
                  ? "var(--warning-ink)"
                  : "var(--text-tertiary)";
            const dueChip = (() => {
              if (it.daysUntil == null) return "—";
              if (it.daysUntil < 0) return `${Math.abs(it.daysUntil)}D OVERDUE`;
              if (it.daysUntil === 0) return "TODAY";
              if (it.daysUntil === 1) return "1D";
              if (it.dueAt) return formatCalendarCompact(new Date(it.dueAt));
              return `${it.daysUntil}D`;
            })();
            return (
              <li key={it.id}>
                <Link
                  href={`/contracts/${it.contractId}#evidence`}
                  className="group flex items-center gap-3 py-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-soft)_18%,transparent)] focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]">
                      {it.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className="inline-flex max-w-[14rem] items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] leading-none text-[var(--text-secondary)]"
                        title={it.contractTitle}
                      >
                        <span className="truncate">{it.contractTitle}</span>
                      </span>
                      {it.counterparty ? (
                        <span
                          className="inline-flex max-w-[10rem] items-center rounded-md border border-[var(--border-card)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--text-tertiary)]"
                          title={it.counterparty}
                        >
                          <span className="truncate">{it.counterparty}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="inline-flex h-[22px] min-w-[5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] leading-none tabular-nums"
                    style={{
                      color: toneInk,
                      borderColor: `color-mix(in oklab, ${toneInk} 28%, var(--border-card))`,
                      background: `color-mix(in oklab, ${toneInk} 10%, var(--surface-raised))`,
                    }}
                  >
                    {dueChip}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-50 transition-opacity group-hover:opacity-100"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
