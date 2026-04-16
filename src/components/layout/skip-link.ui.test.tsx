import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("moves focus to the main content target", () => {
    vi.useFakeTimers();
    renderWithProviders(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          Main
        </main>
      </>
    );

    fireEvent.click(screen.getByRole("link", { name: /skip to main content/i }));
    vi.runAllTimers();

    expect(document.activeElement?.id).toBe("main-content");
    vi.useRealTimers();
  });
});

