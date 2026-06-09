import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/contracts/bulk/page.tsx");
const formRaw = read("src/components/contracts/bulk-upload-form.tsx");

describe("contract import release-state surface", () => {
  it("keeps the import page focused on Core contract tracking", () => {
    // The sidebar h2 "Recent import jobs" was dropped — defect 18
    // flagged it as competing with the trailing "Open contracts" link.
    // The eyebrow "Import status" + CountChip + structured empty state
    // (icon + "No import jobs yet" + caps hint) now carry the section
    // identity. Release-state spec anchors that survive: page eyebrow,
    // page title, sidebar status eyebrow, "Review imported records"
    // affordance, and per-job "Open job details" links.
    for (const copy of [
      'eyebrow="Contract import"',
      'title="Import contracts"',
      "Import status",
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
    // The two import paths are named by source ("Tracker spreadsheet" /
    // "Signed contracts"); the tablist keeps its "Import source"
    // aria-label. The requirements section ("Spreadsheet columns")
    // renders only the seven columns the importer actually persists
    // (title, counterparty, owner_email, contract_type, region,
    // source_system, external_reference_id) as chips with their
    // snake_case authoring headers. Steps use the AI boundary word
    // "suggested" (not "extracted").
    for (const copy of [
      "Tracker spreadsheet",
      "Signed contracts",
      "CSV file",
      "Spreadsheet columns",
      "Contract title",
      "External reference ID",
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
      // Honesty guard: the CSV importer does not persist these, so the
      // requirements section must not advertise them as importable.
      "Termination date",
      "Annual value",
      "Review extracted fields",
    ]) {
      expect(formRaw).not.toContain(forbidden);
    }
  });

  it("keeps the visible Core import surface within the UI punctuation vocabulary", () => {
    expect(`${pageRaw}\n${formRaw}`).not.toContain("·");
  });
});
