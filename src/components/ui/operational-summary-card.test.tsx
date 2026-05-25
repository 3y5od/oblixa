/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import {
  CompressedNormalState,
  DiagnosticDisclosure,
  OperationalQueueRow,
  OperationalSectionHeader,
  OperationalSummaryCard,
  OperationalTriagePanel,
} from "./operational-summary-card";

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

  it("OperationalTriagePanel renders active items and suppresses zero peers", () => {
    render(
      <OperationalTriagePanel
        eyebrow="Operations"
        title="Exceptions and decisions"
        items={[
          { id: "blocked", title: "Blocked work", count: 2, tone: "risk", href: "/work?lens=blocked" },
          { id: "recent", title: "Recent changes", count: 0, tone: "neutral", href: "/contracts" },
        ]}
      />
    );
    expect(screen.getByText("Blocked work")).toBeTruthy();
    expect(screen.queryByText("Recent changes")).toBeNull();
  });

  it("OperationalTriagePanel compresses all-clear states", () => {
    render(
      <OperationalTriagePanel
        eyebrow="Operations"
        title="Exceptions and decisions"
        items={[{ id: "blocked", title: "Blocked work", count: 0 }]}
        allClear={{ title: "No exceptions requiring action", description: "Normal work is compressed." }}
      />
    );
    expect(screen.getByText("No exceptions requiring action")).toBeTruthy();
  });

  it("DiagnosticDisclosure keeps diagnostics behind an explicit summary", () => {
    render(
      <DiagnosticDisclosure title="Data freshness">
        <span>Read-model diagnostic detail</span>
      </DiagnosticDisclosure>
    );
    expect(screen.getByText("Data freshness")).toBeTruthy();
    expect(screen.getByText("Read-model diagnostic detail")).toBeTruthy();
  });

  it("CompressedNormalState renders one compact status", () => {
    render(<CompressedNormalState title="All clear" description="No open exceptions." />);
    expect(screen.getByRole("status").textContent).toContain("All clear");
  });

  it("OperationalSummaryCard compact variant avoids truncating primary labels and actions", () => {
    const { container } = render(
      <OperationalSummaryCard
        eyebrow="Portfolio"
        headline="Contracts"
        tone="healthy"
        icon={FileText}
        primaryValue={1}
        primaryUnit="total records"
        action={{ href: "/contracts", label: "Browse contracts" }}
        variant="compact"
      />
    );
    const article = container.querySelector("article");
    const statusBadges = article?.querySelectorAll(".ui-status-badge");
    const header = article?.querySelector(".ui-kicker")?.closest(".flex.flex-wrap");
    const footer = article?.lastElementChild;
    const action = screen.getByRole("link", { name: /Browse contracts/ });
    const actionLabel = action.querySelector("span");
    expect(screen.getByRole("heading", { name: "Contracts" })).toBeTruthy();
    expect(statusBadges?.length).toBe(1);
    expect(header?.querySelector(".ui-status-badge")).toBeNull();
    expect(footer?.querySelector(".ui-status-badge")).toBeTruthy();
    expect(footer?.className).toContain("flex-col");
    expect(statusBadges?.[0]?.className).toContain("whitespace-normal");
    expect(actionLabel?.className).not.toContain("truncate");
  });
});
