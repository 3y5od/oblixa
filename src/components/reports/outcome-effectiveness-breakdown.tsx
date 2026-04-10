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
      <article className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
        <p className="text-xs text-zinc-500">{title}</p>
        <p className="mt-2 text-sm text-zinc-500">—</p>
      </article>
    );
  }
  return (
    <article className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
      <p className="text-xs text-zinc-500">{title}</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-700">
        {rows.map(([key, avg]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-2 rounded border border-zinc-100 bg-surface px-2 py-1"
          >
            <span className="min-w-0 truncate font-mono text-[11px] text-zinc-600" title={key}>
              {key.replace(/_/g, " ")}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-zinc-900">{avg}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
