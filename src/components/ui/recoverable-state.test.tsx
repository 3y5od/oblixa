/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoverableState } from "./recoverable-state";

describe("RecoverableState", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders recoverable copy with an accessible status name", () => {
    render(
      <RecoverableState
        state="partial"
        title="Work read model is partial"
        reason="Some work items are temporarily unavailable."
        accessibleName="Work read model partial state"
        nextActionLabel="Review health"
        surface="work"
        section="daily-queue"
        sourceObject="work_item"
        nextAction={<Link href="/settings/health">Review health</Link>}
      />
    );

    const status = screen.getByRole("status", { name: "Work read model partial state" });
    expect(status.getAttribute("data-v10-contract-ok")).toBe("true");
    expect(status.getAttribute("data-contract-ok")).toBe("true");
    expect(status.getAttribute("data-v10-focus-target")).toBe("recoverable-state");
    expect(status.getAttribute("data-focus-target")).toBe("recoverable-state");
    expect(status.getAttribute("tabindex")).toBe("-1");
    expect(status.getAttribute("data-v10-next-action-label")).toBe("Review health");
    expect(status.getAttribute("data-next-action-label")).toBe("Review health");
    expect(status.getAttribute("data-v10-surface")).toBe("work");
    expect(status.getAttribute("data-surface")).toBe("work");
    expect(status.getAttribute("data-v10-section")).toBe("daily-queue");
    expect(status.getAttribute("data-section")).toBe("daily-queue");
    expect(status.getAttribute("data-v10-action")).toBe("Review health");
    expect(status.getAttribute("data-action")).toBe("Review health");
    expect(status.getAttribute("data-v10-source-object")).toBe("work_item");
    expect(status.getAttribute("data-source-object")).toBe("work_item");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Work read model is partial")).toBeTruthy();
    expect(screen.getByText("Review health")).toBeTruthy();
  });

  it("keeps neutral and legacy selectors on the same accessible status without adding ID collisions", () => {
    const legacyStateAttribute = ["data", "v" + "10", "state"].join("-");
    const { container } = render(
      <RecoverableState
        state="partial"
        title="Work read model is partial"
        reason="Some work items are temporarily unavailable."
        accessibleName="Work read model partial state"
        surface="work"
        section="daily-queue"
      />
    );

    const status = screen.getByRole("status", { name: "Work read model partial state" });
    expect(container.querySelector(`[${legacyStateAttribute}="partial"]`)).toBe(status);
    expect(container.querySelector('[data-state="partial"]')).toBe(status);
    expect(status.getAttribute("id")).toBeNull();
    expect(status.getAttribute("aria-labelledby")).toBeNull();
    expect(status.getAttribute("aria-describedby")).toBeNull();
  });

  it("announces urgent terminal states as alerts", () => {
    render(
      <RecoverableState
        state="external_link_revoked"
        title="Evidence link revoked"
        reason="This evidence link was revoked."
        accessibleName="Evidence link revoked"
        noActionExplanation="Ask the requester for a new link."
      />
    );

    const alert = screen.getByRole("alert", { name: "Evidence link revoked" });
    expect(alert.getAttribute("data-v10-contract-ok")).toBe("true");
    expect(alert.getAttribute("aria-live")).toBe("assertive");
  });

  it("renders empty states compactly without warning chrome", () => {
    render(
      <RecoverableState
        state="empty"
        title="No exceptions requiring action"
        reason="This workspace has no open work in this view."
        accessibleName="Work all clear state"
        noActionExplanation="Diagnostics remain available from workspace health."
        density="compact"
      />
    );

    const status = screen.getByRole("status", { name: "Work all clear state" });
    expect(status.className).toContain("px-3.5");
    expect(status.className).not.toContain("ui-status-panel-warning");
    expect(screen.getByText("No exceptions requiring action")).toBeTruthy();
  });

  it("marks failed contract-list recovery as a valid alert with an explicit retry action", () => {
    render(
      <RecoverableState
        state="failed"
        title="Contracts could not be loaded"
        reason="The contract list query failed, so this is not being shown as an empty portfolio."
        accessibleName="Contracts list failed state"
        nextActionLabel="Retry contracts"
        nextAction={<Link href="/contracts">Retry contracts</Link>}
      />
    );

    const alert = screen.getByRole("alert", { name: "Contracts list failed state" });
    expect(alert.getAttribute("data-v10-contract-ok")).toBe("true");
    expect(alert.getAttribute("data-v10-state")).toBe("failed");
    expect(alert.getAttribute("data-contract-ok")).toBe("true");
    expect(alert.getAttribute("data-state")).toBe("failed");
    expect(screen.getByRole("link", { name: "Retry contracts" }).getAttribute("href")).toBe("/contracts");
  });

  it("surfaces contract violations in development diagnostics", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_DIAGNOSTICS", "1");
    render(
      <RecoverableState
        state="failed"
        title="Missing recovery copy"
        reason="The operation failed without a next action."
        accessibleName="Invalid failed state"
      />
    );

    const alert = screen.getByRole("alert", { name: "Invalid failed state" });
    expect(alert.getAttribute("data-v10-contract-ok")).toBe("false");
    expect(alert.getAttribute("data-contract-ok")).toBe("false");
    expect(screen.getByText(/State contract needs attention/)).toBeTruthy();
    expect(screen.getByText(/State contract needs attention/).getAttribute("data-contract-failures")).toContain(
      "next_action_or_explanation_required"
    );
    expect(warn).toHaveBeenCalledWith(
      "[v10-recoverable-state] contract violation",
      expect.objectContaining({ state: "failed" })
    );
    warn.mockRestore();
  });

  it("does not surface contract diagnostics in production even when the public flag is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_DIAGNOSTICS", "1");

    render(
      <RecoverableState
        state="failed"
        title="Missing recovery copy"
        reason="The operation failed without a next action."
        accessibleName="Invalid failed state"
      />
    );

    const alert = screen.getByRole("alert", { name: "Invalid failed state" });
    expect(alert.getAttribute("data-v10-contract-ok")).toBe("false");
    expect(screen.queryByText(/State contract needs attention/)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("retains the legacy diagnostics env key as a fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_V10_SUPPORT_DIAGNOSTICS", "1");
    render(
      <RecoverableState
        state="failed"
        title="Missing recovery copy"
        reason="The operation failed without a next action."
        accessibleName="Invalid failed state"
      />
    );

    expect(screen.getByText(/State contract needs attention/)).toBeTruthy();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
