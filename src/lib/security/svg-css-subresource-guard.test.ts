import { describe, expect, it } from "vitest";
import { svgOrCssTextHasRemoteSubresourceRefs } from "@/lib/security/svg-css-subresource-guard";

describe("svgOrCssTextHasRemoteSubresourceRefs", () => {
  it("allows local-only svg", () => {
    expect(svgOrCssTextHasRemoteSubresourceRefs("<svg><rect/></svg>")).toBe(false);
  });

  it("flags xlink:href to http", () => {
    expect(svgOrCssTextHasRemoteSubresourceRefs('<image xlink:href="http://evil.test/x" />')).toBe(true);
  });

  it("flags @import url", () => {
    expect(svgOrCssTextHasRemoteSubresourceRefs("body { color: red; } @import \"https://evil.test/a.css\";")).toBe(true);
  });
});
