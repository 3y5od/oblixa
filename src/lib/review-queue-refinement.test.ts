import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIELD_REVIEW_ACTIONS,
  FIELD_REVIEW_EMPTY_STATE,
  FIELD_REVIEW_REQUIRED_CONTENT,
  FIELD_REVIEW_TITLE,
} from "@/lib/field-review/spec-strings";

const reviewPage = () =>
  readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/review/page.tsx"), "utf8");

const loadingPage = () =>
  readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/review/loading.tsx"), "utf8");

describe("field review release-state workspace", () => {
  it("uses the release-state page identity and empty state", () => {
    const raw = reviewPage();

    expect(FIELD_REVIEW_TITLE).toBe("Review fields");
    expect(FIELD_REVIEW_EMPTY_STATE).toBe("No fields need review.");
    expect(raw).toContain("export const metadata = { title: FIELD_REVIEW_TITLE }");
    expect(raw).toContain("title={FIELD_REVIEW_TITLE}");
    expect(raw).toContain("eyebrow={FIELD_REVIEW_EYEBROW}");
    expect(raw).toContain("All contracts");
    expect(raw).toContain("FIELD_REVIEW_EMPTY_STATE");
  });

  it("renders every required field-review content label and action", () => {
    const raw = reviewPage();
    const actionRaw = readFileSync(
      join(process.cwd(), "src/components/contracts/field-review-workspace-actions.tsx"),
      "utf8"
    );

    for (const label of FIELD_REVIEW_REQUIRED_CONTENT) {
      expect(raw).toContain(label);
    }
    for (const label of FIELD_REVIEW_ACTIONS) {
      expect(`${raw}\n${actionRaw}`).toContain(label);
    }
  });

  it("uses the field-review model instead of table-first queue structure", () => {
    const raw = reviewPage();

    expect(raw).toContain("loadFieldReviewWorkspaceModel");
    expect(raw).toContain("FieldReviewWorkspaceActions");
    expect(raw).not.toContain("ContractTable");
    expect(raw).not.toContain("ContractPagination");
    expect(raw).not.toContain("ReviewQueueStartGuide");
    expect(raw).not.toContain("SectionHeader");
    expect(raw).not.toContain("Start review");
    expect(raw).not.toContain("Contracts pending review");
    expect(raw).not.toContain("landing-corner-ring");
  });

  it("keeps legacy query params harmless and selected target params explicit", () => {
    const raw = reviewPage();
    const model = readFileSync(join(process.cwd(), "src/lib/field-review/model.ts"), "utf8");

    expect(raw).toContain("page?: string; contract?: string; field?: string");
    expect(raw).toContain("safeUuid(searchParams.contract)");
    expect(raw).toContain("safeUuid(searchParams.field)");
    expect(model).toContain("selectedContractId");
    expect(model).toContain("selectedFieldId");
  });

  it("keeps loading state aligned to the field-review workspace", () => {
    const raw = loadingPage();

    expect(raw).toContain("Loading review fields");
    expect(raw).toContain("ui-card-raised");
    expect(raw).toContain("lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.74fr)]");
    expect(raw).not.toContain("Loading review queue");
    expect(raw).not.toContain("xl:grid-cols-4");
  });
});
