import { describe, expect, it } from "vitest";
import { checklistRowOrderFromSetupChecklist } from "@/lib/onboarding/onboarding-banner-checklist-order";

describe("checklistRowOrderFromSetupChecklist", () => {
  it("returns default order when checklist is undefined", () => {
    expect(checklistRowOrderFromSetupChecklist(undefined)).toEqual(["upload", "review", "approve"]);
  });

  it("returns default order when checklist is empty", () => {
    expect(checklistRowOrderFromSetupChecklist([])).toEqual(["upload", "review", "approve"]);
  });

  it("puts review first when compliance_alignment is first", () => {
    expect(checklistRowOrderFromSetupChecklist(["compliance_alignment", "upload_contract"])).toEqual([
      "review",
      "upload",
      "approve",
    ]);
  });

  it("puts review first when compliance_alignment appears later", () => {
    expect(checklistRowOrderFromSetupChecklist(["upload_contract", "compliance_alignment"])).toEqual([
      "review",
      "upload",
      "approve",
    ]);
  });

  it("puts review first when first step is review_fields", () => {
    expect(checklistRowOrderFromSetupChecklist(["review_fields", "upload_contract"])).toEqual([
      "review",
      "upload",
      "approve",
    ]);
  });

  it("puts upload first when bulk_import is first", () => {
    expect(checklistRowOrderFromSetupChecklist(["bulk_import", "review_fields"])).toEqual([
      "upload",
      "review",
      "approve",
    ]);
  });

  it("puts upload first when bulk_import appears later", () => {
    expect(checklistRowOrderFromSetupChecklist(["upload_contract", "bulk_import"])).toEqual([
      "upload",
      "review",
      "approve",
    ]);
  });

  it("puts approve first when first step is organize_work", () => {
    expect(checklistRowOrderFromSetupChecklist(["organize_work", "upload_contract"])).toEqual([
      "approve",
      "upload",
      "review",
    ]);
  });

  it("compliance_alignment wins over review_fields when both present (compliance checked first in impl)", () => {
    expect(checklistRowOrderFromSetupChecklist(["review_fields", "compliance_alignment"])).toEqual([
      "review",
      "upload",
      "approve",
    ]);
  });

  it("returns default for unrecognized first step without special includes", () => {
    expect(checklistRowOrderFromSetupChecklist(["upload_contract", "review_fields"])).toEqual([
      "upload",
      "review",
      "approve",
    ]);
  });
});
