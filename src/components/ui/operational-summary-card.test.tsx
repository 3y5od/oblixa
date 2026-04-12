/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalQueueRow, OperationalSectionHeader } from "./operational-summary-card";

describe("OperationalSummaryCard primitives", () => {
  afterEach(() => {
    cleanup();
  });

  it("OperationalSectionHeader renders eyebrow, title, and description", () => {
    render(<OperationalSectionHeader eyebrow="Area" title="Queue" description="Supporting copy." />);
    expect(screen.getByText("Area")).toBeTruthy();
    expect(screen.getByText("Queue")).toBeTruthy();
    expect(screen.getByText("Supporting copy.")).toBeTruthy();
  });

  it("OperationalQueueRow uses a same-document anchor for hash-only href", () => {
    const { container } = render(
      <OperationalQueueRow href="#main-content" title="Risk lane" actionLabel="Jump" />
    );
    const anchor = container.querySelector('a[href="#main-content"]');
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toContain("Risk lane");
    expect(anchor?.textContent).toContain("Jump");
  });
});
