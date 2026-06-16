import type { Dispatch, SetStateAction } from "react";
import { Building2, ChevronDown, ClipboardList, Database, FileSignature, Globe, Hash, SlidersHorizontal } from "lucide-react";
import { UiSelect, type UiSelectOption } from "@/components/ui/ui-select";
import { UploadField } from "@/components/contracts/upload-field";
import { UploadSection } from "@/components/contracts/upload-section";
import { CONTRACT_TYPE_OPTIONS, type MetadataDraft } from "./upload-form-types";

export function UploadDetailsSection({
  metadata,
  setMetadata,
  ownerOptions,
  fieldsDisabled,
  titleInvalid,
  setTitleTouched,
}: {
  metadata: MetadataDraft;
  setMetadata: Dispatch<SetStateAction<MetadataDraft>>;
  ownerOptions: UiSelectOption[];
  fieldsDisabled: boolean;
  titleInvalid: boolean;
  setTitleTouched: (value: boolean) => void;
}) {
  return (
    <>
      <UploadSection
        step={2}
        icon={ClipboardList}
        title="Contract details"
        lead="Add the details you already know. Suggested details from the document can be confirmed after upload."
      >
        <div className="space-y-4">
          <UploadField
            id="title"
            label="Contract name"
            required
            icon={FileSignature}
            help={titleInvalid ? undefined : "This name appears in contracts, tasks, evidence requests, and reports."}
            error={titleInvalid ? "Contract name is required" : undefined}
          >
            <input
              id="title"
              name="title"
              type="text"
              required
              value={metadata.title}
              onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))}
              onBlur={() => setTitleTouched(true)}
              placeholder="Example: Acme Services Agreement"
              disabled={fieldsDisabled}
              aria-invalid={titleInvalid || undefined}
              aria-describedby={titleInvalid ? "title-error" : undefined}
              className={`ui-input-compact w-full pl-9 ${titleInvalid ? "border-[color:color-mix(in_oklab,var(--danger-ink)_55%,var(--border-strong))] focus-visible:border-[color:color-mix(in_oklab,var(--danger-ink)_60%,var(--border-strong))] focus-visible:shadow-[0_0_0_1px_color-mix(in_oklab,var(--danger-ink)_45%,transparent),0_0_0_4px_color-mix(in_oklab,var(--danger-ink)_18%,transparent)]" : ""}`}
            />
          </UploadField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UploadField id="counterparty" label="Counterparty" icon={Building2}>
              <input id="counterparty" name="counterparty" type="text" value={metadata.counterparty} onChange={(e) => setMetadata((m) => ({ ...m, counterparty: e.target.value }))} placeholder="Example: Northstar Supply LLC" disabled={fieldsDisabled} className="ui-input-compact w-full min-w-0 pl-9" />
            </UploadField>
            <UploadField id="ownerId" label="Owner" help="The owner receives reminders and appears on tasks, evidence requests, and reports.">
              <UiSelect id="ownerId" className="block w-full" buttonClassName="w-full" value={metadata.ownerId} onChange={(value) => setMetadata((m) => ({ ...m, ownerId: value }))} options={ownerOptions} placeholder={ownerOptions.length > 0 ? "You (creator)" : "No workspace members"} search searchPlaceholder="Search members" emptyLabel="No members match" portal disabled={fieldsDisabled || ownerOptions.length === 0} />
            </UploadField>
          </div>
          <UploadField id="contractType" label="Contract type">
            <UiSelect id="contractType" className="block w-full" buttonClassName="w-full" name="contractType" value={metadata.contractType} onChange={(value) => setMetadata((m) => ({ ...m, contractType: value }))} options={CONTRACT_TYPE_OPTIONS} placeholder="Select contract type" portal disabled={fieldsDisabled} />
          </UploadField>
        </div>
      </UploadSection>
      <UploadOptionalDetails metadata={metadata} setMetadata={setMetadata} fieldsDisabled={fieldsDisabled} />
    </>
  );
}

function UploadOptionalDetails({
  metadata,
  setMetadata,
  fieldsDisabled,
}: {
  metadata: MetadataDraft;
  setMetadata: Dispatch<SetStateAction<MetadataDraft>>;
  fieldsDisabled: boolean;
}) {
  return (
    <details className="group border-t border-[color:color-mix(in_oklab,var(--border-subtle)_70%,transparent)]">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 outline-none transition-colors marker:hidden hover:bg-[color:color-mix(in_oklab,var(--surface-muted)_40%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-6 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.85} aria-hidden />
        <span className="text-[13px] font-medium leading-none text-[var(--text-primary)]">Optional contract details</span>
        <span className="text-[11px] font-normal leading-none text-[var(--text-tertiary)]">Optional</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
      </summary>
      <div className="ui-details-reveal px-5 pb-5 sm:px-6">
        <p className="mb-4 text-[12px] leading-snug text-[var(--text-secondary)]">
          Add commercial and source details you already know. You can review suggested dates and terms after upload.
        </p>
        <div className="space-y-4">
          <div>
            <p className="mb-2.5 text-[11px] font-medium leading-none text-[var(--text-tertiary)]">Commercial details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UploadField id="region" label="Region" icon={Globe}>
                <input id="region" name="region" type="text" value={metadata.region} onChange={(e) => setMetadata((m) => ({ ...m, region: e.target.value }))} placeholder="Region or geography" disabled={fieldsDisabled} className="ui-input-compact w-full min-w-0 pl-9" />
              </UploadField>
              <UploadField id="annualValue" label="Contract value">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="inline-flex items-center rounded-md border border-[var(--border-card)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--text-tertiary)]">USD</span>
                </span>
                <input id="annualValue" name="annualValue" type="number" min="0" step="0.01" inputMode="decimal" value={metadata.annualValue} onChange={(e) => setMetadata((m) => ({ ...m, annualValue: e.target.value }))} placeholder="Amount" disabled={fieldsDisabled} className="ui-input-compact w-full min-w-0 pl-[3.25rem] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </UploadField>
            </div>
          </div>
          <div className="border-t border-[color:color-mix(in_oklab,var(--border-subtle)_60%,transparent)] pt-4">
            <p className="mb-2.5 text-[11px] font-medium leading-none text-[var(--text-tertiary)]">Source details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UploadField id="sourceSystem" label="Source system" icon={Database}>
                <input id="sourceSystem" name="sourceSystem" type="text" value={metadata.sourceSystem} onChange={(e) => setMetadata((m) => ({ ...m, sourceSystem: e.target.value }))} placeholder="Spreadsheet, folder, or system name" disabled={fieldsDisabled} className="ui-input-compact w-full min-w-0 pl-9" />
              </UploadField>
              <UploadField id="externalReferenceId" label="External reference" icon={Hash}>
                <input id="externalReferenceId" name="externalReferenceId" type="text" value={metadata.externalReferenceId} onChange={(e) => setMetadata((m) => ({ ...m, externalReferenceId: e.target.value }))} placeholder="e.g. Airtable record ID" disabled={fieldsDisabled} className="ui-input-compact w-full min-w-0 pl-9 font-mono" />
              </UploadField>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
