import { describe, expect, it } from "vitest";
import {
  deepRedactEmailLikeInUnknown,
  formatUnknownForServerLog,
  redactEmailLikeSubstrings,
} from "./log-redaction";

describe("log-redaction", () => {
  it("redacts email-like substrings", () => {
    expect(redactEmailLikeSubstrings("ping ops@corp.test now")).toBe("ping [redacted] now");
  });

  it("formats unknown server log values without dumping huge payloads verbatim", () => {
    const s = formatUnknownForServerLog({ nested: "x".repeat(5000) });
    expect(s.length).toBeLessThan(4500);
    expect(s).toContain("…");
  });

  it("deep-redacts nested structures", () => {
    const out = deepRedactEmailLikeInUnknown({ a: ["ok", "bad@corp.test"] });
    expect(JSON.stringify(out)).not.toContain("@corp.test");
  });
});
