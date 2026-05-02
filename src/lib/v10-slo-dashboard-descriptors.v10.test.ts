import { describe, expect, it } from "vitest";
import { V10_SLO_DASHBOARD_EVIDENCE } from "./v10-objective-telemetry";
import { getV10SloDashboardDescriptorExport, V10_SLO_DASHBOARD_DESCRIPTORS } from "./v10-slo-dashboard-descriptors";

describe("v10-slo-dashboard-descriptors", () => {
  it("exports one descriptor per SLO evidence row", () => {
    expect(V10_SLO_DASHBOARD_DESCRIPTORS.length).toBe(V10_SLO_DASHBOARD_EVIDENCE.length);
    expect(getV10SloDashboardDescriptorExport()).toEqual(V10_SLO_DASHBOARD_DESCRIPTORS);
  });

  it("uses HTTPS URL templates without secrets", () => {
    for (const row of V10_SLO_DASHBOARD_DESCRIPTORS) {
      expect(row.dashboardUrlTemplate.startsWith("https://")).toBe(true);
      expect(/token=|secret|signed/i.test(row.dashboardUrlTemplate)).toBe(false);
      expect(row.diagnosticId.startsWith("v10_")).toBe(true);
    }
  });
});
