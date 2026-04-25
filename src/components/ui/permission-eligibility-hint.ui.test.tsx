import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { PermissionEligibilityHint, type PermissionEligibilityVariant } from "./permission-eligibility-hint";

const VARIANTS: PermissionEligibilityVariant[] = [
  "hidden",
  "disabled",
  "empty",
  "filtered_out",
  "not_permitted",
  "not_in_current_mode",
];

describe("PermissionEligibilityHint", () => {
  it.each(VARIANTS)("renders copy for %s", (variant) => {
    const { unmount, container } = renderWithProviders(<PermissionEligibilityHint variant={variant} />);
    expect(container.querySelector("p")?.textContent?.length).toBeGreaterThan(10);
    unmount();
  });

  it("renders optional action link", () => {
    renderWithProviders(
      <PermissionEligibilityHint variant="not_permitted" actionLabel="Go to settings" actionHref="/settings" />
    );
    const link = screen.getByRole("link", { name: "Go to settings" });
    expect(link.getAttribute("href")).toBe("/settings");
  });
});
