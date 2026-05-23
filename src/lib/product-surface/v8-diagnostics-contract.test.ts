import { beforeEach, describe, expect, it, vi } from "vitest";
import { logProductSurfaceDiagnostic } from "@/lib/product-surface/dev-diagnostics";

const breadcrumbSpy = vi.fn();

vi.mock("@/lib/observability/sentry-client", () => ({
  addProductSurfaceDiagnosticBreadcrumb: (...args: unknown[]) => breadcrumbSpy(...args),
}));

describe("v8 diagnostics contract", () => {
  beforeEach(() => {
    breadcrumbSpy.mockReset();
  });

  it("emits structured mapping-missing diagnostics", () => {
    const payload = {
      surfaceType: "api",
      apiPath: "/api/example",
      reason: "registry_missing_or_mapping_missing",
      mode: "core",
      role: "viewer",
    };
    logProductSurfaceDiagnostic("surface_mapping_missing", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("surface_mapping_missing", payload);
  });

  it("uses safe payload keys for eligibility denials", () => {
    const payload = {
      actionId: "contracts:createContract",
      featureFamily: "contracts",
      denialClass: "insufficient_workspace_mode",
      mode: "core",
      role: "viewer",
    };
    logProductSurfaceDiagnostic("server_action_eligibility_denied", payload);

    const [, emitted] = breadcrumbSpy.mock.calls[0] as [string, Record<string, unknown>];
    const sensitiveKey = Object.keys(emitted).find((key) =>
      /token|cookie|secret|authorization/i.test(key)
    );
    expect(sensitiveKey).toBeUndefined();
  });

  it("emits structured landing normalization diagnostics", () => {
    const payload = {
      mode: "advanced",
      requested: "/decisions",
      reason: "invalid_for_surface_eligibility",
      fallback: "/dashboard",
    };
    logProductSurfaceDiagnostic("landing_path_normalized", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("landing_path_normalized", payload);
  });

  it("covers nav badge diagnostics with mode + removed keys (§19.3 subset)", () => {
    const payload = { mode: "core" as const, removed_keys: ["watchlists"] };
    logProductSurfaceDiagnostic("nav_badges", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("nav_badges", payload);
  });

  it("covers nav badge payload filter diagnostics", () => {
    const payload = {
      mode: "core" as const,
      removed_keys: ["watchlists"],
      incoming_count: 2,
      outgoing_count: 1,
    };
    logProductSurfaceDiagnostic("nav_badge_payload_filtered", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("nav_badge_payload_filtered", payload);
  });

  it("covers cmd-K recent href diagnostics", () => {
    const payload = { mode: "core" as const, removed_count: 1 };
    logProductSurfaceDiagnostic("cmdk_recent_hrefs", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("cmdk_recent_hrefs", payload);
  });

  it("covers API workspace gate denial diagnostics", () => {
    const payload = {
      apiPath: "/api/decisions",
      family: "decisions",
      reason: "workspace_mode_ineligible",
      denialClass: "insufficient_workspace_mode",
      discoverability: "suppressed",
    };
    logProductSurfaceDiagnostic("api_workspace_gate_denied", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("api_workspace_gate_denied", payload);
  });

  it("covers cmd-K search index filter diagnostics", () => {
    const payload = { mode: "core" as const, dropped_count: 2, query_len: 3 };
    logProductSurfaceDiagnostic("cmdk_search_index_filtered", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("cmdk_search_index_filtered", payload);
  });

  it("covers href eligibility denial diagnostics", () => {
    const payload = {
      href: "/decisions",
      pathname: "/decisions",
      family: "decisions",
      reason: "workspace_mode_ineligible",
      denialClass: "insufficient_workspace_mode",
      discoverability: "suppressed",
    };
    logProductSurfaceDiagnostic("href_eligibility_denied", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("href_eligibility_denied", payload);
  });

  it("covers page surface mapping missing diagnostics", () => {
    const payload = { surfaceType: "page" as const, pathname: "/unknown-dashboard" };
    logProductSurfaceDiagnostic("surface_mapping_missing", payload);
    expect(breadcrumbSpy).toHaveBeenCalledWith("surface_mapping_missing", payload);
  });
});
