import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const pageRaw = read("src/app/(dashboard)/contracts/new/page.tsx");
const formRaw = [
  "src/components/contracts/upload-form.tsx",
  "src/components/contracts/upload-source-section.tsx",
  "src/components/contracts/upload-details-section.tsx",
  "src/components/contracts/upload-form-notices.tsx",
  "src/components/contracts/upload-form-action-bar.tsx",
].map(read).join("\n");
const railRaw = read("src/components/contracts/contract-upload-rail.tsx");

describe("contract upload release-state surface", () => {
  it("keeps the upload page focused on signed-contract Core intake", () => {
    expect(pageRaw).toContain('eyebrow="New contract"');
    expect(pageRaw).toContain('title="Upload contract"');
    // Spreadsheet migration is offered as a quiet supporting action framed as
    // importing an existing tracker — not a raw "Import CSV" mechanic or a
    // migration center (release-state §/contracts/new + §/contracts/bulk). It now
    // lives in the context rail beside the editor.
    expect(railRaw).toContain("Import contracts");
    expect(railRaw).toContain("Import tracker rows");
    // No Advanced/Assurance/pre-signature framing leaks into any intake surface.
    for (const raw of [pageRaw, formRaw, railRaw]) {
      expect(raw).not.toContain("Advanced");
      expect(raw).not.toContain("Assurance");
      expect(raw).not.toContain("redlines");
      expect(raw).not.toContain("e-signature");
    }
  });

  it("keeps metadata, source documents, and review path visible in the form", () => {
    // Required identity (name/counterparty/owner/type) sits above the fold
    // under "Contract details"; region/value/source/reference move into the
    // optional "Optional contract details" disclosure but every spec-mandated
    // field label still renders in the DOM. (The Tags editor was removed from
    // this form in the intake redesign, so it is no longer asserted here.)
    for (const label of [
      "Contract details",
      "Contract name",
      "Counterparty",
      "Contract type",
      "Region",
      "Contract value",
      "Source system",
      "External reference",
      "Source document",
      "Upload contract",
    ]) {
      expect(formRaw).toContain(label);
    }
    // `extractionStatus` still drives the post-create outcome summary even
    // though user-facing copy now says "field suggestions" per the AI
    // boundary. Banned anti-patterns retained.
    expect(formRaw).toContain("extraction");
    expect(formRaw).not.toContain("Input workflow");
    expect(formRaw).not.toContain("Create contract without files");
  });
});
