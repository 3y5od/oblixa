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
    { label: "Field reviews (approve / edit / reject)", value: fieldsReviewed },
  ];

  return (
    <div className="ui-card p-6 shadow-none">
      <h2 className="ui-section-title">Usage</h2>
      <p className="mt-1 text-xs font-medium text-zinc-500">{periodLabel}</p>
      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-4 py-3.5"
          >
            <dt className="text-xs font-medium text-zinc-500">{item.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
