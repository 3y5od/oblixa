import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitCmdkPaletteOpenedTelemetry } from "./product-telemetry";

const { getAuthContext, emitProductTelemetryEvent } = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  emitProductTelemetryEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthContext,
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIpFromHeaders: vi.fn(async () => "127.0.0.1"),
  rateLimitCheck: vi.fn(async () => ({ ok: true })),
  RATE_LIMITS: { productV9Telemetry: { limit: 1, window: "1m" } },
}));

vi.mock("@/lib/product-telemetry", () => ({
  emitProductTelemetryEvent,
}));

describe("product telemetry server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid Cmd-K open telemetry source before auth", async () => {
    await emitCmdkPaletteOpenedTelemetry({ source: "unsafe-surface" as never });

    expect(getAuthContext).not.toHaveBeenCalled();
    expect(emitProductTelemetryEvent).not.toHaveBeenCalled();
  });
});
