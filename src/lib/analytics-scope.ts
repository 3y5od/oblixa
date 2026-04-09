function normalizeScopedFilter(raw: string | undefined, options: string[]): string {
  const candidate = raw?.trim() || "all";
  if (candidate === "all") return "all";
  return options.includes(candidate) ? candidate : "all";
}

export function normalizeAnalyticsScope(input: {
  ownerRaw?: string;
  regionRaw?: string;
  typeRaw?: string;
  ownerOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
}) {
  return {
    ownerFilter: normalizeScopedFilter(input.ownerRaw, input.ownerOptions),
    regionFilter: normalizeScopedFilter(input.regionRaw, input.regionOptions),
    typeFilter: normalizeScopedFilter(input.typeRaw, input.typeOptions),
  };
}
