import { describe, expect, it } from "vitest";
import { outboundEventTierForType } from "@/lib/product-surface/outbound-event-tier";

describe("outboundEventTierForType", () => {
  it("maps program events to advanced", () => {
    expect(outboundEventTierForType("program.applied")).toBe("advanced");
  });

  it("defaults operational contract events to core", () => {
    expect(outboundEventTierForType("contract.updated")).toBe("core");
    expect(outboundEventTierForType("approval.requested")).toBe("core");
  });
});
