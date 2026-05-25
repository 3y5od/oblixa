import { V10_SLO_DASHBOARD_EVIDENCE } from "./objective-telemetry";

/**
 * Post-GA / RC SLO dashboard **descriptors** (no secrets): stable keys, owners,
 * and HTTPS URL **templates** for wiring provider dashboards (Datadog, Grafana, etc.).
 * Replace `{{diagnosticId}}` with the row's `diagnosticId` when surfacing in ops UIs.
 */
export type V10SloDashboardDescriptor = {
  dashboardKey: string;
  metricKey: string;
  diagnosticId: string;
  owner: string;
  releaseWindow: string;
  /** Example panel deep-link pattern — must stay token-free per validateV10SloDashboardEvidence. */
  dashboardUrlTemplate: string;
};

const BASE = "https://oblixa-telemetry.example.com/panels";

export const V10_SLO_DASHBOARD_DESCRIPTORS: readonly V10SloDashboardDescriptor[] = V10_SLO_DASHBOARD_EVIDENCE.map(
  (row) => ({
    dashboardKey: row.dashboardKey,
    metricKey: row.metricKey,
    diagnosticId: row.diagnosticId,
    owner: row.owner,
    releaseWindow: row.releaseWindow,
    dashboardUrlTemplate: `${BASE}/${row.diagnosticId}`,
  })
);

export function getV10SloDashboardDescriptorExport(): readonly V10SloDashboardDescriptor[] {
  return V10_SLO_DASHBOARD_DESCRIPTORS;
}

// Version-name compatibility aliases. Prefer neutral exports in new code.
export { getV10SloDashboardDescriptorExport as getSloDashboardDescriptorExport };
export { V10_SLO_DASHBOARD_DESCRIPTORS as SLO_DASHBOARD_DESCRIPTORS };
export type { V10SloDashboardDescriptor as SloDashboardDescriptor };
// End version-name compatibility aliases.
