import { Activity, ChevronRight, FileText, Send } from "lucide-react";
import {
  SettingsHealthDiagnosticsSections,
  type SettingsHealthDiagnosticsSectionsProps,
} from "./settings-health-diagnostics-sections";

type SettingsHealthSupportDisclosureProps = {
  reportMetadataLabel: string;
  deliveryMetadataLabel: string;
  diagnostics: SettingsHealthDiagnosticsSectionsProps;
};

export function SettingsHealthSupportDisclosure({
  reportMetadataLabel,
  deliveryMetadataLabel,
  diagnostics,
}: SettingsHealthSupportDisclosureProps) {
  return (
    <details id="support" className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 border-y border-[color:var(--border-card)] py-3 outline-none transition-colors marker:hidden hover:border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border-subtle))] bg-[color:color-mix(in_oklab,var(--accent-soft)_22%,var(--surface-raised))] text-[var(--accent-strong)]">
          <Activity className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Support diagnostics</span>
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" aria-hidden />
              <span>{reportMetadataLabel}</span>
            </span>
            <span aria-hidden>-</span>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3 w-3" aria-hidden />
              <span>{deliveryMetadataLabel}</span>
            </span>
          </span>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="py-4 pl-10">
        <span id="v10-runtime" className="sr-only" aria-hidden="true" />
        <span id="mutations" className="sr-only" aria-hidden="true" />
        <span id="artifacts" className="sr-only" aria-hidden="true" />
        <span id="providers" className="sr-only" aria-hidden="true" />
        <span id="canary" className="sr-only" aria-hidden="true" />
        <span id="rollback" className="sr-only" aria-hidden="true" />
        <SettingsHealthDiagnosticsSections {...diagnostics} />
      </div>
    </details>
  );
}
