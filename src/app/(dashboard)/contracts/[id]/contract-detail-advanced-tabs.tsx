import type { ContractDetailPageModel } from "./contract-detail-page-model";
import * as D from "./contract-detail-view-deps";

export function ContractDetailAdvancedTabs({ model }: { model: ContractDetailPageModel }) {
  const { contract, allTabLinks, activeTab, primaryTabGroups } = model;

  return (
      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)]/90 bg-[color:color-mix(in_oklab,var(--surface-muted)_52%,transparent)] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {primaryTabGroups.map(({ value, label, tabs }) => {
              const activeGroup = (tabs as readonly string[]).includes(activeTab);
              return (
                <D.Link
                  key={value}
                  href={`/contracts/${contract.id}?tab=${value}`}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors md:text-[12.5px] ${
                    activeGroup
                      ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-fg)]"
                      : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,var(--surface-raised))] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] hover:text-[var(--text-primary)]"
                  }`}
                  aria-current={activeGroup ? "page" : undefined}
                >
                  {label}
                </D.Link>
              );
            })}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-[var(--text-secondary)]">
              More sections
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allTabLinks.map(([value, label]) => (
              <D.Link
                key={value}
                href={`/contracts/${contract.id}?tab=${value}`}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors md:text-[12.5px] ${
                  activeTab === value
                    ? "border-[var(--accent-strong)] bg-[var(--accent-strong)] text-[var(--accent-fg)]"
                    : "border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface)_84%,var(--surface-raised))] text-[var(--text-secondary)] hover:bg-[color:color-mix(in_oklab,var(--surface-contrast)_74%,transparent)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </D.Link>
              ))}
            </div>
          </details>
        </div>
      </div>
  );
}
