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

describe("review queue release-state workspace", () => {
  it("uses the release-state page identity and empty state", () => {
    const raw = reviewPage();

    expect(FIELD_REVIEW_TITLE).toBe("Contract Review Queue");
    expect(FIELD_REVIEW_EMPTY_STATE).toBe("No details need confirmation.");
    expect(raw).toContain("export const metadata = { title: FIELD_REVIEW_TITLE }");
    expect(raw).toContain("{FIELD_REVIEW_TITLE}");
    // The route identity uses the canonical DashboardPageHeader (icon medallion +
    // eyebrow + title + lead), matching the rest of the contracts surface. The
    // breadcrumb lives in the app topbar, so the page header no longer repeats it.
    expect(raw).toContain("Review suggested contract dates, owners, and terms against source text");
    expect(raw).toContain("DashboardPageHeader");
    expect(raw).toContain('eyebrow="Contracts"');
    expect(raw).toContain("FIELD_REVIEW_EMPTY_STATE");
  });

  it("renders every required field-review content label and action", () => {
    const raw = reviewPage();
    const actionRaw = readFileSync(
      join(process.cwd(), "src/components/contracts/field-review-workspace-actions.tsx"),
      "utf8"
    );
    // The workbench markup lives in the review component family (the page is a
    // thin orchestrator); scan the panes for the required content labels.
    const componentRaw = [
      "review-control-bar.tsx",
      "review-decision-pane.tsx",
      "review-evidence-rail.tsx",
      "review-queue-rail.tsx",
    ]
      .map((file) => readFileSync(join(process.cwd(), "src/components/contracts/review", file), "utf8"))
      .join("\n");
    const surface = `${raw}\n${componentRaw}`;

    for (const label of FIELD_REVIEW_REQUIRED_CONTENT) {
      expect(surface).toContain(label);
    }
    for (const label of FIELD_REVIEW_ACTIONS) {
      expect(`${surface}\n${actionRaw}`).toContain(label);
    }
  });

  it("uses the review model instead of table-first queue structure", () => {
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

  it("keeps loading state aligned to the review workspace", () => {
    const raw = loadingPage();

    expect(raw).toContain("Loading details to confirm");
    expect(raw).toContain("ui-card");
    // The review workspace is a full-height review unit (queue rail | detail +
    // source proof | decision footer spanning the unit); the loading skeleton
    // mirrors its responsive grid template — two grid rows at xl (panes row +
    // auto decision row) with the source column widened so the excerpt reads as a
    // page.
    expect(raw).toContain("lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]");
    expect(raw).toContain("xl:grid-cols-[minmax(13rem,16rem)_minmax(23rem,33rem)_minmax(26rem,1fr)]");
    expect(raw).toContain("xl:grid-rows-[minmax(0,1fr)_auto]");
    expect(raw).toContain("xl:h-[calc(100dvh-156px)]");
    expect(raw).not.toContain("Loading review queue");
    expect(raw).not.toContain("xl:grid-cols-4");
  });
});
