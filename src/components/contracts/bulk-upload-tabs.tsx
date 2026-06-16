import type { KeyboardEvent } from "react";
import { IMPORT_METHODS, type ImportPath } from "./bulk-upload-form-types";

export function BulkUploadTabs({
  activePath,
  tabRefs,
  onSelect,
  onKeyDown,
}: {
  activePath: ImportPath;
  tabRefs: { current: (HTMLButtonElement | null)[] };
  onSelect: (path: ImportPath) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="border-b border-[color:color-mix(in_oklab,var(--border-subtle)_85%,transparent)] px-5 py-3">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,transparent)] p-1"
        role="tablist"
        aria-label="Import source"
        onKeyDown={onKeyDown}
      >
        {IMPORT_METHODS.map((item, index) => {
          const ItemIcon = item.icon;
          const selected = activePath === item.key;
          return (
            <button
              key={item.key}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`import-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`import-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(item.key)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                selected
                  ? "bg-[var(--surface-raised)] font-semibold text-[var(--accent-strong)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_28%,var(--border-subtle))]"
                  : "font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <ItemIcon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        {IMPORT_METHODS.find((method) => method.key === activePath)?.description}
      </p>
    </div>
  );
}
