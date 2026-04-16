import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { AuthForm } from "./auth-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [undefined, vi.fn(), false] as const,
  };
});

describe("AuthForm", () => {
  it("renders login content and forgot-password path", () => {
    renderWithProviders(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /forgot password/i })).toBeTruthy();
  });

  it("renders signup-specific full name field", () => {
    renderWithProviders(<AuthForm mode="signup" />);
    expect(screen.getByLabelText("Full name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
  });
});

