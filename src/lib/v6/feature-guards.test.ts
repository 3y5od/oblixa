import { beforeEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabled = vi.fn();
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: (k: string) => isFeatureEnabled(k),
}));

const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

describe("v6 feature-guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("assertV6PageFeature calls notFound when disabled", async () => {
    isFeatureEnabled.mockReturnValue(false);
    const { assertV6PageFeature } = await import("@/lib/v6/feature-guards");
    assertV6PageFeature("v6AssuranceCore");
    expect(notFound).toHaveBeenCalled();
  });

  it("requireV6ApiFeature returns 403 response when disabled", async () => {
    isFeatureEnabled.mockReturnValue(false);
    const { requireV6ApiFeature } = await import("@/lib/v6/feature-guards");
    const res = requireV6ApiFeature("v6AssuranceCore");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(res!.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res!.headers.get("Vary")).toContain("Cookie");
  });

  it("requireV6CronFeature returns skipped when disabled", async () => {
    isFeatureEnabled.mockReturnValue(false);
    const { requireV6CronFeature } = await import("@/lib/v6/feature-guards");
    const res = requireV6CronFeature("v6AssuranceCore");
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.skipped).toBe(true);
  });
});
