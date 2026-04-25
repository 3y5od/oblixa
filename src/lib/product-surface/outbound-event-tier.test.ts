import { describe, expect, it } from "vitest";
import { outboundEventTierForType } from "@/lib/product-surface/outbound-event-tier";

describe("outbound event product tiers", () => {
  it("classifies portfolio outbound events as Advanced", () => {
    expect(outboundEventTierForType("program.applied")).toBe("advanced");
    expect(outboundEventTierForType("renewal.decision_packet_generated")).toBe("advanced");
  });

  it("inherits notification taxonomy for known normalized event types", () => {
    expect(outboundEventTierForType("control.failure")).toBe("assurance");
  });

  it("defaults unknown operational events to Core instead of dropping delivery", () => {
    expect(outboundEventTierForType("contract.uploaded")).toBe("core");
    expect(outboundEventTierForType("contract.updated")).toBe("core");
    expect(outboundEventTierForType("approval.requested")).toBe("core");
  });
});
