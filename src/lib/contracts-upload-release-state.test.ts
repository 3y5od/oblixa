import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/contracts/new/page.tsx");
const formRaw = read("src/components/contracts/upload-form.tsx");

describe("contract upload release-state surface", () => {
  it("keeps the upload page focused on signed-contract Core intake", () => {
    expect(pageRaw).toContain('eyebrow="New record"');
    expect(pageRaw).toContain('title="Upload contract"');
    // v23 aesthetic pass: the multi-clause page lead ("Create one
    // signed-contract record, attach PDF or DOCX source files, then
    // review the extracted fields, dates, owners, work, evidence, and
    // reports...") was dropped per §10.7 (no small plain text) +
    // §10.4 (eliminate redundancy). Spec mandates only the page title
    // + CTAs + spec content; the descriptive lead was authorial prose
    // not in the release-state spec. The structural anchors that ARE
    // in spec remain pinned below.
    expect(pageRaw).toContain("Import CSV");
    expect(pageRaw).not.toContain("Advanced");
    expect(pageRaw).not.toContain("Assurance");
    expect(pageRaw).not.toContain("redlines");
    expect(pageRaw).not.toContain("e-signature");
  });

  it("keeps metadata, source documents, and review path visible in the form", () => {
    // v23: subsection h3s ("Required identity first" / "Attach signed
    // files now") + their accompanying leads were dropped — the column
    // border + the field labels carry the structure. Spec-mandated
    // field labels + eyebrows + primary CTA all remain.
    for (const label of [
      "Record metadata",
      "Contract title",
      "Counterparty",
      "Contract type",
      "Region",
      "Annual value",
      "Source system",
      "External reference",
      "Source documents",
      "Create contract",
    ]) {
      expect(formRaw).toContain(label);
    }
    // The "source-backed review" phrase was part of the dropped prose
    // lead. `extraction` still surfaces in the warning chip + disabled
    // reason copy. Banned anti-patterns retained.
    expect(formRaw).toContain("extraction");
    expect(formRaw).not.toContain("Input workflow");
    expect(formRaw).not.toContain("Create contract without files");
  });
});
