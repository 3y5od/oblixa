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
    { label: "Field reviews (approve/edit/reject)", value: fieldsReviewed },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Usage</h2>
      <p className="mt-1 text-xs text-gray-500">{periodLabel}</p>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <dt className="text-xs font-medium text-gray-500">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
