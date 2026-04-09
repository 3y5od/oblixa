import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFeatureEnabled } from "@/lib/feature-flags";

const mockNotFound = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

import {
  assertAnyV5PageFeature,
  requireV5ApiFeature,
  requireV5CronFeature,
} from "@/lib/v5/feature-guards";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}));

const mockedFlags = vi.mocked(isFeatureEnabled);

describe("v5 feature guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requireV5ApiFeature returns null when enabled", () => {
    mockedFlags.mockReturnValue(true);
    expect(requireV5ApiFeature("v5DecisionFoundation")).toBeNull();
  });

  it("requireV5ApiFeature returns 403 when disabled", () => {
    mockedFlags.mockReturnValue(false);
    const res = requireV5ApiFeature("v5DecisionFoundation");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("requireV5CronFeature returns skip payload when disabled", async () => {
    mockedFlags.mockReturnValue(false);
    const res = requireV5CronFeature("v5PortfolioCampaigns");
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
  });

  it("assertAnyV5PageFeature calls notFound when every flag is off", () => {
    mockNotFound.mockClear();
    mockedFlags.mockReturnValue(false);
    assertAnyV5PageFeature(["v5ControlRoomUx", "v5DecisionFoundation"]);
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("assertAnyV5PageFeature does not call notFound when one flag is on", () => {
    mockNotFound.mockClear();
    mockedFlags.mockImplementation((k) => k === "v5DecisionFoundation");
    assertAnyV5PageFeature(["v5ControlRoomUx", "v5DecisionFoundation"]);
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
