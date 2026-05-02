/**
 * @vitest-environment node
 */
import { createElement } from "react";
import { describe, expect, it } from "vitest";

describe("@react-pdf/renderer smoke", () => {
  it("emits a non-empty PDF buffer for a one-page doc", async () => {
    const { pdf, Document, Page, Text } = await import("@react-pdf/renderer");
    const doc = createElement(
      Document,
      null,
      createElement(Page, { size: "A4" }, createElement(Text, null, "oblixa-contract-smoke"))
    );
    const blob = await pdf(doc).toBlob();
    const ab = await blob.arrayBuffer();
    const buf = Buffer.from(ab);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
