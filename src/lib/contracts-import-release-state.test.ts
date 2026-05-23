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
    // v23 aesthetic pass: the verbose page lead ("Bring in an existing
    // tracking spreadsheet or a batch of signed PDF/DOCX agreements...
    // extracted fields, owners, dates, obligations, evidence, and
    // reports.") was dropped per §10.7 (no small plain text) + §10.4
    // (eliminate redundancy). The sidebar lead ("Confirm created
    // records...") + empty-state lead were also dropped — the eyebrows
    // + h2 + link targets carry the structure. Release-state spec
    // mandates that survive: page eyebrow + title + sidebar status
    // anchors + Open job details link.
    for (const copy of [
      'eyebrow="Contract import"',
      'title="Import contracts"',
      "Import status",
      "Recent import jobs",
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
    // v23: the form h2 ("Replace the tracking spreadsheet"), the
    // long form lead, the signed-files h3 + sub-paragraph, the prose
    // queued-files counter, the Review path h3 + sub-lead, the
    // selected-summary footer, and the sticky-footer prose were all
    // dropped per §10.7 + §10.4 + §10.14 (subtraction is a design
    // move). The eyebrow ("Import source"), method tabs, field
    // labels, column-group eyebrow + values, file-format chips
    // ("PDF or DOCX", "20 MB max"), Review path eyebrow + step list,
    // and primary CTA remain as the spec-mandated anchors.
    for (const copy of [
      "Import CSV",
      "Signed files",
      "CSV file",
      "Minimum spreadsheet shape",
      "title, counterparty",
      "contract_type, owner_email, region",
      "source_system, external_reference_id",
      "Signed PDF or DOCX files",
      "Review extracted fields",
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
    ]) {
      expect(formRaw).not.toContain(forbidden);
    }
  });

  it("keeps the visible Core import surface within the UI punctuation vocabulary", () => {
    expect(`${pageRaw}\n${formRaw}`).not.toContain("·");
  });
});
