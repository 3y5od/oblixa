import { describe, expect, it } from "vitest";
import { stripDangerousHtmlTags } from "./simple-markdown-sanitize";

describe("stripDangerousHtmlTags", () => {
  it("removes script blocks", () => {
    expect(stripDangerousHtmlTags('<p>ok</p><script>alert(1)</script>')).not.toContain("script");
    expect(stripDangerousHtmlTags('<p>ok</p>')).toContain("ok");
  });

  it("removes iframe open tags", () => {
    expect(stripDangerousHtmlTags('<iframe src="evil">')).not.toContain("iframe");
  });
});
