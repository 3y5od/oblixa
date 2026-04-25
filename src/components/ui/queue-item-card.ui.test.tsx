import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { QueueItemCard } from "./queue-item-card";

describe("QueueItemCard", () => {
  it("renders title link, status, chips, and next action", () => {
    renderWithProviders(
      <QueueItemCard
        title="Acme MSA"
        href="/contracts/c1"
        objectType="Contract"
        statusLabel="Active"
        statusTone="healthy"
        nextAction={{ label: "Open review", href: "/contracts/c1/review" }}
      />
    );

    const titleLink = screen.getByRole("link", { name: "Acme MSA" });
    expect(titleLink.getAttribute("href")).toBe("/contracts/c1");
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open review/i }).getAttribute("href")).toBe("/contracts/c1/review");
  });
});
