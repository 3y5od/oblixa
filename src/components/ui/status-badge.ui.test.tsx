import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { StatusBadge, type SemanticStatus } from "./status-badge";

const STATUSES: SemanticStatus[] = [
  "healthy",
  "info",
  "in_review",
  "warning",
  "blocked",
  "overdue",
  "critical",
  "empty",
  "disabled",
];

describe("StatusBadge", () => {
  it.each(STATUSES)("renders status %s with badge text", (status) => {
    renderWithProviders(
      <StatusBadge status={status} className="x-test">
        {status} label
      </StatusBadge>
    );
    const el = document.querySelector(".x-test.ui-status-badge");
    expect(el).toBeTruthy();
    expect(screen.getByText(`${status} label`)).toBeTruthy();
  });
});
