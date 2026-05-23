import { describe, expect, it } from "vitest";
import { escapeIcsTextValue, escapeVcardValue, foldIcsTextLine } from "./calendar-text-guard";

describe("calendar / vCard text guards", () => {
  it("folds long ICS lines with CRLF continuation", () => {
    const long = `DESCRIPTION:${"x".repeat(80)}`;
    const folded = foldIcsTextLine(long, 75);
    expect(folded).toContain("\r\n ");
    expect(folded.replace(/\r\n /g, "")).toContain("x".repeat(80));
  });

  it("escapes vCard structural characters", () => {
    expect(escapeVcardValue("a,b;c")).toBe("a\\,b\\;c");
    expect(escapeVcardValue("line\nbreak")).toBe("line\\nbreak");
  });

  it("escapes ICS structural characters", () => {
    expect(escapeIcsTextValue("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeIcsTextValue("line\r\nbreak")).toBe("line\\nbreak");
  });
});
