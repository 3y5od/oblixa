import { describe, expect, it } from "vitest";
import { renderDecisionPacketPdfBuffer } from "./decision-intelligence/decision-packet-pdf";

describe("renderDecisionPacketPdfBuffer", () => {
  it("returns a non-empty PDF buffer for minimal input", async () => {
    const buf = await renderDecisionPacketPdfBuffer({
      title: "Test packet",
      packetType: "summary",
      exportedAt: "2026-01-01",
      bodyText: "Hello from the test suite.",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("chunks long body text across pages", async () => {
    const body = "x".repeat(8000);
    const buf = await renderDecisionPacketPdfBuffer({
      title: "Long",
      packetType: "full",
      exportedAt: null,
      bodyText: body,
    });
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
