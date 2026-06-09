/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { signOut } from "@/actions/auth";
import { AccountMenu } from "./account-menu";

vi.mock("@/actions/auth", () => ({ signOut: vi.fn() }));

describe("AccountMenu (DropdownMenu adoption — runtime)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens the portaled menu and exposes account destinations + sign out", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" />,
    );

    const trigger = screen.getByRole("button", { name: /account menu for jane doe/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Closed: no menuitems rendered.
    expect(screen.queryByRole("menuitem", { name: /settings/i })).toBeNull();

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByRole("menuitem", { name: /^settings$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /account security/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeTruthy();
  });

  it("submits the sign-out form from the portaled menu", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /account menu for jane doe/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(vi.mocked(signOut)).toHaveBeenCalledTimes(1));
  });

  it("closes after activating a destination", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" />,
    );
    const trigger = screen.getByRole("button", { name: /account menu for jane doe/i });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^settings$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: /^settings$/i })).toBeNull(),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
