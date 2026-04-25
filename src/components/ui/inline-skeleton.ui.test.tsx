import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { InlineSkeleton } from "./inline-skeleton";

describe("InlineSkeleton", () => {
  it("renders a decorative skeleton with aria-hidden", () => {
    const { container } = renderWithProviders(
      <InlineSkeleton widthClass="w-10" heightClass="h-3" className="test-sk" />
    );
    const span = container.querySelector("span.test-sk");
    expect(span).toBeTruthy();
    expect(span?.getAttribute("aria-hidden")).toBe("true");
    expect(span?.className).toMatch(/ui-skeleton/);
  });
});
