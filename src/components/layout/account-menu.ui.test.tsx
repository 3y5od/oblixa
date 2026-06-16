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
    expect(await screen.findByRole("menuitem", { name: /^workspace settings$/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /account security/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeTruthy();
  });

  it("shows Billing and access plus a sentence-case role pill for Admin/Owner", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" role="admin" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /account menu for jane doe/i }));
    expect(await screen.findByRole("menuitem", { name: /billing and access/i })).toBeTruthy();
    // Role reads "Admin", never shouted "ADMIN".
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.queryByText("ADMIN")).toBeNull();
  });

  it("hides Billing and access from Member/Viewer", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" role="member" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /account menu for jane doe/i }));
    await screen.findByRole("menuitem", { name: /^workspace settings$/i });
    expect(screen.queryByRole("menuitem", { name: /billing and access/i })).toBeNull();
  });

  it("submits the sign-out form from the portaled menu", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /account menu for jane doe/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(vi.mocked(signOut)).toHaveBeenCalledTimes(1));
  });

  it("stays open while scrolling INSIDE the menu, but closes on a page scroll", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" role="admin" />,
    );
    const trigger = screen.getByRole("button", { name: /account menu for jane doe/i });
    fireEvent.click(trigger);
    const signOut = await screen.findByRole("menuitem", { name: /sign out/i });

    // Scrolling the menu's own overflow region to reach the last item must NOT
    // dismiss it — the capture-phase window scroll listener has to ignore
    // scrolls that originate inside the surface. (Regression: a tall account
    // menu closed the instant the user scrolled toward "Sign out".)
    fireEvent.scroll(signOut, {});
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeTruthy();

    // A genuine page scroll (target outside the surface) still dismisses it so
    // the menu never detaches from its trigger.
    fireEvent.scroll(document, {});
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });

  it("closes after activating a destination", async () => {
    renderWithProviders(
      <AccountMenu displayName="Jane Doe" email="jane@example.com" initial="J" />,
    );
    const trigger = screen.getByRole("button", { name: /account menu for jane doe/i });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^workspace settings$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: /^workspace settings$/i })).toBeNull(),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
