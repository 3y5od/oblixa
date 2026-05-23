import { describe, expect, it } from "vitest";
import {
  buildWorkspaceHealthItem,
  filterWorkspaceHealthItems,
  formatIsoMinute,
  formatPercentOrNoSample,
  formatSampleDetail,
  getAffectedWorkspaceHealthCount,
  getOverallWorkspaceHealthStatus,
  parseWorkspaceHealthMode,
  type WorkspaceHealthStatus,
} from "./workspace-health-model";

describe("workspace health model", () => {
  const items = [
    buildWorkspaceHealthItem({
      id: "imports",
      area: "imports",
      label: "Imports",
      status: "healthy",
      visibility: "user",
      modes: ["core"],
    }),
    buildWorkspaceHealthItem({
      id: "approvals",
      area: "approvals",
      label: "Approvals",
      status: "delayed",
      visibility: "user",
      modes: ["advanced"],
      requiredFeature: "utility:approval_workload",
    }),
    buildWorkspaceHealthItem({
      id: "scorecards",
      area: "assurance",
      label: "Scorecards",
      status: "needs_attention",
      visibility: "user",
      modes: ["assurance"],
    }),
    buildWorkspaceHealthItem({
      id: "route-hooks",
      area: "configuration",
      label: "Route hooks",
      status: "needs_attention",
      visibility: "internal",
      modes: ["core"],
    }),
    buildWorkspaceHealthItem({
      id: "unavailable-feed",
      area: "integrations",
      label: "Unavailable feed",
      status: "unavailable",
      visibility: "user",
      modes: ["core"],
    }),
  ];

  it("filters workflow health by workspace mode and visibility", () => {
    expect(filterWorkspaceHealthItems(items, "core", "user").map((item) => item.id)).toEqual(["imports"]);
    expect(filterWorkspaceHealthItems(items, "advanced", "user").map((item) => item.id)).toEqual([
      "approvals",
      "imports",
    ]);
    expect(filterWorkspaceHealthItems(items, "assurance", "user").map((item) => item.id)).toEqual([
      "scorecards",
      "approvals",
      "imports",
    ]);
  });

  it("keeps internal diagnostics out of user-visible health", () => {
    expect(filterWorkspaceHealthItems(items, "assurance", "user").some((item) => item.id === "route-hooks")).toBe(
      false
    );
  });

  it("filters hidden module features without presenting them as failures", () => {
    expect(
      filterWorkspaceHealthItems(items, "advanced", "user", new Set(["utility:approval_workload"])).map(
        (item) => item.id
      )
    ).toEqual(["imports"]);
  });

  it("derives affected counts and overall status from visible workflow status", () => {
    const advanced = filterWorkspaceHealthItems(items, "advanced", "user");
    expect(getAffectedWorkspaceHealthCount(advanced)).toBe(1);
    expect(getOverallWorkspaceHealthStatus(advanced)).toBe("delayed");
  });

  it("treats not configured as visible attention without outranking delayed work", () => {
    const visible = [
      buildWorkspaceHealthItem({
        id: "imports",
        area: "imports",
        label: "Imports",
        status: "healthy",
        visibility: "user",
        modes: ["core"],
      }),
      buildWorkspaceHealthItem({
        id: "recovery",
        area: "notifications",
        label: "Recovery",
        status: "not_configured",
        visibility: "user",
        modes: ["core"],
      }),
    ];
    expect(getAffectedWorkspaceHealthCount(visible)).toBe(1);
    expect(getOverallWorkspaceHealthStatus(visible)).toBe("not_configured");

    expect(
      getOverallWorkspaceHealthStatus([
        ...visible,
        buildWorkspaceHealthItem({
          id: "delayed",
          area: "reports",
          label: "Delayed report",
          status: "delayed",
          visibility: "user",
          modes: ["core"],
        }),
      ])
    ).toBe("delayed");
  });

  it("keeps overall status priority ordered by operational severity", () => {
    const makeItem = (status: WorkspaceHealthStatus) =>
      buildWorkspaceHealthItem({
        id: status,
        area: "configuration",
        label: status,
        status,
        visibility: "user",
        modes: ["core"],
      });
    expect(
      getOverallWorkspaceHealthStatus(
        (["healthy", "not_configured", "delayed", "needs_attention", "blocked"] as const).map(makeItem)
      )
    ).toBe("blocked");
    expect(
      getOverallWorkspaceHealthStatus(
        (["healthy", "not_configured", "delayed", "needs_attention"] as const).map(makeItem)
      )
    ).toBe("needs_attention");
    expect(
      getOverallWorkspaceHealthStatus((["healthy", "not_configured", "delayed"] as const).map(makeItem))
    ).toBe("delayed");
    expect(getOverallWorkspaceHealthStatus((["healthy", "not_configured"] as const).map(makeItem))).toBe(
      "not_configured"
    );
    expect(getOverallWorkspaceHealthStatus((["healthy"] as const).map(makeItem))).toBe("healthy");
  });

  it("excludes unavailable items from user-visible scoring", () => {
    const core = filterWorkspaceHealthItems(items, "core", "user");
    expect(core.some((item) => item.id === "unavailable-feed")).toBe(false);
    expect(getOverallWorkspaceHealthStatus(core)).toBe("healthy");
  });

  it("formats nullable health samples without inventing perfect rates", () => {
    expect(formatPercentOrNoSample(null, "No sample yet")).toBe("No sample yet");
    expect(formatPercentOrNoSample(100, "No sample yet")).toBe("100.0%");
    expect(formatSampleDetail(0, 0, "report run")).toBe("No report runs sampled");
    expect(formatSampleDetail(1, 2, "delivery")).toBe("1 successful delivery; 2 failed deliveries");
    expect(formatIsoMinute("2026-05-09T12:34:56.000Z")).toBe("2026-05-09T12:34");
  });

  it("parses unsupported workspace modes as core", () => {
    expect(parseWorkspaceHealthMode("unknown")).toBe("core");
    expect(parseWorkspaceHealthMode("advanced")).toBe("advanced");
    expect(parseWorkspaceHealthMode("assurance")).toBe("assurance");
  });
});
