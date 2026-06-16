import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/contracts/bulk/page.tsx");
const formRaw = [
  "src/components/contracts/bulk-upload-form.tsx",
  "src/components/contracts/bulk-upload-form-types.ts",
  "src/components/contracts/bulk-upload-csv-columns.tsx",
  "src/components/contracts/bulk-upload-tabs.tsx",
  "src/components/contracts/bulk-upload-result-region.tsx",
  "src/components/contracts/bulk-upload-csv-panel.tsx",
  "src/components/contracts/bulk-upload-files-panel.tsx",
  "src/components/contracts/bulk-upload-action-bar.tsx",
].map(read).join("\n");

describe("contract import release-state surface", () => {
  it("keeps the import page focused on Core contract tracking", () => {
    // The page is framed as "Import tracker rows" (the visible product object is
    // the tracker becoming contract records). The job-history rail is titled
    // "Import jobs" with a CountChip + structured empty state (icon + "No tracker
    // imports yet" + caps hint). Release-state spec anchors that survive: page
    // eyebrow, page title, the job-rail title, the "Review imported records"
    // inventory affordance (which links to /contracts, so it keeps "records"),
    // and per-job "Open job details" links.
    for (const copy of [
      'eyebrow="Contract import"',
      'title="Import tracker rows"',
      "Import jobs",
      "Review imported records",
      "Open job details",
    ]) {
      expect(pageRaw).toContain(copy);
    }

    for (const forbidden of [
      "Scale ingest",
      "Hygiene",
      "campaign",
      "maintenance",
      "Advanced",
      "Assurance",
      "redline",
      "e-signature",
      "Import recovery",
      "Job details JSON",
    ]) {
      expect(pageRaw).not.toContain(forbidden);
    }
  });

  it("keeps CSV and signed-file import paths visible without non-Core framing", () => {
    // The two import paths are named by source ("Tracker CSV" / "Signed
    // contract files"); the tablist keeps its "Import source" aria-label.
    // The requirements section is now the ImportSchemaTable titled "Tracker
    // CSV requirements" and renders only the seven columns the importer
    // actually persists (title, counterparty, owner_email, contract_type,
    // region, source_system, external_reference_id) as rows with their
    // human label + snake_case authoring header. The human labels are now
    // "Contract name" (header token `title` unchanged) and "External
    // reference" (header token `external_reference_id` unchanged). The CSV
    // field keeps the accessible name "Tracker CSV file". Steps use the AI
    // boundary word "suggested" (not "extracted").
    for (const copy of [
      "Tracker CSV",
      "Signed contract files",
      "CSV file",
      "Tracker CSV requirements",
      "Contract name",
      "External reference",
      "title",
      "owner_email",
      "contract_type",
      "source_system",
      "external_reference_id",
      "Signed PDF or DOCX files",
      "Confirm suggested details",
      "Open job details",
    ]) {
      expect(formRaw).toContain(copy);
    }

    for (const forbidden of [
      "OpenAI",
      "Scale ingest",
      "Backfill",
      "campaign",
      "maintenance",
      "Advanced",
      "Assurance",
      "Inspect job diagnostics",
      // Honesty guard: the CSV importer does not persist contract value or
      // dates, so the requirements section must not advertise them as
      // importable. "Annual value" stays banned; "Contract value" (the new
      // /contracts/new field label) is added so the importer can never claim
      // to import value under either name. "Termination date" stays banned.
      "Termination date",
      "Annual value",
      "Contract value",
      "Review extracted fields",
    ]) {
      expect(formRaw).not.toContain(forbidden);
    }
  });

  it("keeps the visible Core import surface within the UI punctuation vocabulary", () => {
    expect(`${pageRaw}\n${formRaw}`).not.toContain("·");
  });
});
