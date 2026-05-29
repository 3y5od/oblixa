import { describe, expect, it } from "vitest";
import { DECISION_PACKET_SAFE_PDF_METADATA } from "@/lib/decision-intelligence/decision-packet-pdf";

describe("decision packet PDF metadata", () => {
  it("uses product-safe metadata instead of customer packet fields", () => {
    expect(DECISION_PACKET_SAFE_PDF_METADATA).toMatchObject({
      title: "Oblixa decision packet",
      author: "Oblixa",
      creator: "Oblixa",
      producer: "Oblixa",
    });
    expect(Object.values(DECISION_PACKET_SAFE_PDF_METADATA).join(" ")).not.toMatch(/Acme|secret|customer/i);
  });
});
