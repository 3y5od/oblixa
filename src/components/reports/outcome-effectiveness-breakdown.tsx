/**
 * Human-readable list of effectiveness buckets (replaces raw JSON in outcome intelligence UI).
 */
export function OutcomeEffectivenessBreakdown({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    return (
      <article className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
        <p className="text-xs text-[var(--text-tertiary)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">—</p>
      </article>
    );
  }
  return (
    <article className="rounded-xl border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{title}</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--text-secondary)]">
        {rows.map(([key, avg]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-2 rounded border border-[var(--border-subtle)] bg-surface px-2 py-1"
          >
            <span className="min-w-0 truncate font-mono text-[11px] text-[var(--text-secondary)]" title={key}>
              {key.replace(/_/g, " ")}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[var(--text-primary)]">{avg}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
