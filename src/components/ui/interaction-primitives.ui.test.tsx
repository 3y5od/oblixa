import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { ApiJsonLink } from "./api-json-link";
import { AsyncActionButton } from "./async-action-button";
import { ConfirmActionButton } from "./confirm-action-button";
import { InlineMutationStatus } from "./inline-mutation-status";

describe("interaction primitives", () => {
  it("renders async action pending state accessibly", () => {
    renderWithProviders(
      <AsyncActionButton pending pendingLabel="Saving" className="ui-btn-primary">
        Save
      </AsyncActionButton>
    );

    const button = screen.getByRole("button", { name: /saving/i });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("disabled")).not.toBeNull();
  });

  it("renders inline mutation status semantics", () => {
    renderWithProviders(<InlineMutationStatus variant="error" message="Request failed." />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders api json links with safe target behavior", () => {
    renderWithProviders(<ApiJsonLink href="/api/example">Open JSON</ApiJsonLink>);
    const link = screen.getByRole("link", { name: /open json/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("requires confirmation before running confirmed actions", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmActionButton
        className="ui-btn-secondary"
        confirmMessage="Are you sure?"
        onConfirm={onConfirm}
        pendingLabel="Removing"
      >
        Remove
      </ConfirmActionButton>
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});