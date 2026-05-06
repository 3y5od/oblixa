/** @vitest-environment jsdom */
import "@/test-utils/mock-navigation";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import {
  RelationshipWorkspaceActions,
  buildRelationshipWorkspaceActions,
} from "./relationship-workspace-actions";

describe("RelationshipWorkspaceActions", () => {
  it("builds the required V10 continuity actions for account workspaces", () => {
    const actions = buildRelationshipWorkspaceActions({
      relationshipKind: "account",
      relationshipKey: "acme",
      sourceContractId: "contract-1",
    });

    expect(actions.map((action) => action.label)).toEqual([
      "Review filtered contracts",
      "Review related work",
      "Review renewal horizon",
      "Request evidence",
      "Create task",
      "Create exception",
      "Review timeline",
    ]);
    expect(actions.find((action) => action.label === "Review filtered contracts")?.href).toBe(
      "/contracts?q=acme&account_key=acme"
    );
    expect(actions.find((action) => action.label === "Request evidence")?.href).toBe(
      "/contracts/contract-1?tab=overview#contract-evidence"
    );
  });

  it("renders disabled source actions when a relationship has no lead contract", () => {
    renderWithProviders(
      <RelationshipWorkspaceActions relationshipKind="counterparty" relationshipKey="globex" />
    );

    expect(screen.getByRole("link", { name: /review filtered contracts/i }).getAttribute("href")).toBe(
      "/contracts?q=globex&counterparty_key=globex"
    );
    expect(screen.getByRole("link", { name: /request evidence/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: /create task/i }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: /review timeline/i }).getAttribute("href")).toBe("#relationship-timeline");
  });
});
