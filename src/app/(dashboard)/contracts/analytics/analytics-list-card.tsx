type AnalyticsListCardProps = {
  eyebrow: string;
  title: string;
  rows: ReadonlyArray<readonly [string, number]>;
  emptyLabel: string;
  truncateLabel?: boolean;
};

export function AnalyticsListCard({
  eyebrow,
  title,
  rows,
  emptyLabel,
  truncateLabel = false,
}: AnalyticsListCardProps) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_55%,var(--canvas))] px-5 py-3">
        <p className="ui-eyebrow">{eyebrow}</p>
        <h2 className="ui-section-title mt-1 text-base">{title}</h2>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {rows.length === 0 ? (
          <li className="px-5 py-4 text-sm text-[var(--text-tertiary)]">{emptyLabel}</li>
        ) : (
          rows.map(([label, count]) => (
            <li key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className={`${truncateLabel ? "truncate " : ""}text-[var(--text-secondary)]`}>
                {label}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">{count}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
