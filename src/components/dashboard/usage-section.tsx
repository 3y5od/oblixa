interface UsageSectionProps {
  contractsCreated: number;
  extractionsRun: number;
  fieldsReviewed: number;
  periodLabel: string;
}

export function UsageSection({
  contractsCreated,
  extractionsRun,
  fieldsReviewed,
  periodLabel,
}: UsageSectionProps) {
  const items = [
    { label: "Contracts created", value: contractsCreated },
    { label: "AI extractions", value: extractionsRun },
    { label: "Field reviews", value: fieldsReviewed },
  ];

  return (
    <section className="ui-card overflow-hidden">
      <div className="ui-surface-tint px-6 py-4">
        <h2 className="ui-section-title">Workspace activity</h2>
        <p className="mt-1 text-[12px] font-medium text-[var(--text-tertiary)]">{periodLabel}</p>
      </div>
      <div className="grid divide-y divide-[var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col justify-center px-6 py-5 sm:min-h-[5.5rem]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {item.label}
            </p>
            <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
