/** @vitest-environment jsdom */
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { ReviewSaveNextTelemetryLink } from "./review-save-next-telemetry-link";

const emit = vi.fn();

vi.mock("@/actions/product-telemetry", () => ({
  emitReviewSaveNextUsedTelemetry: () => emit(),
}));

describe("ReviewSaveNextTelemetryLink", () => {
  afterEach(() => {
    emit.mockReset();
  });

  it("emits telemetry on first click, then throttles for 30s", async () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <ReviewSaveNextTelemetryLink href="/contracts/review?x=1">Next</ReviewSaveNextTelemetryLink>
      );
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      expect(emit).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      expect(emit).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      fireEvent.click(screen.getByRole("link", { name: "Next" }));
      expect(emit).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
