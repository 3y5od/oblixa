import { ChevronRight, ShieldCheck } from "lucide-react";
import type { WorkspaceHealthItem } from "@/lib/workspace-health-model";

function usefulHealthChips(item: WorkspaceHealthItem) {
  return (item.chips ?? []).filter((chip) => chip.value !== "0");
}

function hasUsefulHealthyDetail(item: WorkspaceHealthItem): boolean {
  return usefulHealthChips(item).length > 0 || /\d{4}-\d{2}-\d{2}/.test(item.detail ?? "");
}

function healthyDetailText(item: WorkspaceHealthItem): string {
  const chips = usefulHealthChips(item);
  if (chips.length > 0) {
    return chips.map((chip) => `${chip.label}: ${chip.value}`).join(" - ");
  }
  return item.detail ?? "Clear";
}

function HealthCheckRow({ item }: { item: WorkspaceHealthItem }) {
  const detail = healthyDetailText(item);
  return (
    <li className="group/row flex items-center gap-3 py-2 text-sm">
      <span
        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--success-ink)] ring-2 ring-[color:color-mix(in_oklab,var(--success-soft)_42%,transparent)]"
        aria-hidden
      />
      <span className="shrink-0 text-[14px] font-medium text-[var(--text-primary)]">{item.label}</span>
      <span
        className="min-w-0 flex-1 truncate text-right font-mono text-[11px] text-[var(--text-tertiary)]"
        title={detail}
      >
        {detail}
      </span>
    </li>
  );
}

type SettingsHealthHealthyChecksProps = {
  items: WorkspaceHealthItem[];
};

export function SettingsHealthHealthyChecks({ items }: SettingsHealthHealthyChecksProps) {
  if (items.length === 0) return null;

  const detailedItems = items.filter(hasUsefulHealthyDetail);
  const additionalHealthyCount = items.length - detailedItems.length;
  const clearLabel = items.length === 1 ? "is clear" : "are clear";

  return (
    <details id="healthy-workflow-checks" className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 border-y border-[color:var(--border-card)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--success)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--success)_22%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--success-soft)_32%,var(--surface-raised))] text-[var(--success-ink)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--text-primary)]">
          <span className="tabular-nums">{items.length}</span> workflow check{items.length === 1 ? "" : "s"}{" "}
          {clearLabel}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="py-3 pl-10">
        <ul className="flex flex-col divide-y divide-[color:color-mix(in_oklab,var(--border-subtle)_55%,transparent)]">
          {detailedItems.map((item) => (
            <HealthCheckRow key={item.id} item={item} />
          ))}
          {additionalHealthyCount > 0 ? (
            <li className="flex items-center gap-3 py-2 text-[12.5px] text-[var(--text-tertiary)]">
              <span
                className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[color:color-mix(in_oklab,var(--success-ink)_55%,var(--border-contrast))]"
                aria-hidden
              />
              <span>
                +<span className="font-mono tabular-nums">{additionalHealthyCount}</span> additional workflow check
                {additionalHealthyCount === 1 ? "" : "s"} clear
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </details>
  );
}
