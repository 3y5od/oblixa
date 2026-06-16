import { Download } from "lucide-react";
import { ImportSchemaTable } from "@/components/contracts/import-schema-table";
import { CSV_COLUMNS } from "./bulk-upload-form-types";
import { downloadTemplate } from "./bulk-upload-form-utils";

export function BulkUploadCsvColumns() {
  const schemaRows = CSV_COLUMNS.map((column) => ({
    label: column.label,
    header: column.header,
    required: column.required,
    becomes: column.becomes,
  }));

  return (
    <div>
      <ImportSchemaTable
        title="Tracker CSV requirements"
        rows={schemaRows}
        templateAction={
          <button
            type="button"
            onClick={downloadTemplate}
            className="ui-btn-secondary inline-flex max-w-max items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-semibold"
          >
            <Download className="h-3 w-3" strokeWidth={2} aria-hidden />
            Download tracker CSV template
          </button>
        }
      />
      <ul className="mt-2.5 space-y-1 text-[11.5px] leading-snug text-[var(--text-tertiary)]">
        <li>Rows missing a contract name or counterparty are returned for correction.</li>
        <li>A file with duplicate rows is rejected, so nothing imports twice.</li>
        <li>Unknown columns are ignored.</li>
        <li>Renewal and notice dates, value, and status are added during review, not imported.</li>
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-[var(--text-tertiary)]">
        UTF-8 CSV, up to 2 MB. Imported details are suggested and need confirmation before use.
      </p>
    </div>
  );
}
