import { describe, expect, it } from "vitest";
import { buildDecisionPacketRunHtml } from "@/lib/v5/decision-packet-html";

describe("buildDecisionPacketRunHtml", () => {
  it("escapes script-like strings in decision fields so HTML is not executable", () => {
    const html = buildDecisionPacketRunHtml({
      decisionId: "d1",
      runId: "r1",
      packetType: "t",
      exportedAt: null,
      createdAt: null,
      payload: {
        decision: {
          title: '<img src=x onerror=alert(1)>',
          decision_type: '</script><script>alert(1)</script>',
          status: '"><svg onload=alert(1)>',
        },
      },
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;/script&gt;");
    expect(html).toContain("&lt;img");
    // Must not introduce raw HTML tags with event handlers (escaped text may still mention onerror=).
    expect(html).not.toMatch(/<[a-z][^>]*\sonerror\s*=/i);
    expect(html).not.toMatch(/<[a-z][^>]*\sonload\s*=/i);
  });

  it("escapes unicode titles without throwing", () => {
    const html = buildDecisionPacketRunHtml({
      decisionId: "d1",
      runId: "r1",
      packetType: "t",
      exportedAt: null,
      createdAt: null,
      payload: {
        decision: {
          title: "日本語 — “smart quotes” & <tags>",
          decision_type: "renewal_recommendation",
          status: "open",
        },
      },
    });
    expect(html).toContain("日本語");
    expect(html).not.toContain("<tags>");
    expect(html).toContain("&lt;tags&gt;");
  });
});
