import { describe, it, expect } from "vitest";
import { escapeXmlText } from "./feed-xml-escape";

describe("escapeXmlText", () => {
  it("neutralizes angle brackets and ampersands", () => {
    expect(escapeXmlText(`<script>alert(1)</script>`)).not.toContain("<script>");
    expect(escapeXmlText(`Tom & Jerry`)).toBe("Tom &amp; Jerry");
  });
});
