import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import { AuthForm } from "./auth-form";

const authMocks = vi.hoisted(() => {
  type AuthActionResult = { error: string } | { success: string } | { redirectTo: string };
  type AuthActionMock = (formData: FormData) => Promise<AuthActionResult>;

  return {
    assignNavigableHref: vi.fn(() => true),
    forgotPassword: vi.fn<AuthActionMock>(async () => ({ success: "Check your email for a password reset link." })),
    resetPassword: vi.fn<AuthActionMock>(async () => ({ redirectTo: "/dashboard" })),
    signIn: vi.fn<AuthActionMock>(async () => ({ redirectTo: "/dashboard" })),
    signUp: vi.fn<AuthActionMock>(async () => ({ redirectTo: "/dashboard" })),
  };
});

vi.mock("@/actions/auth", () => ({
  forgotPassword: authMocks.forgotPassword,
  resetPassword: authMocks.resetPassword,
  signIn: authMocks.signIn,
  signUp: authMocks.signUp,
}));

vi.mock("@/lib/navigation/client-navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/navigation/client-navigation")>();
  return {
    ...actual,
    assignNavigableHref: authMocks.assignNavigableHref,
  };
});

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.forgotPassword.mockResolvedValue({ success: "Check your email for a password reset link." });
    authMocks.resetPassword.mockResolvedValue({ redirectTo: "/dashboard" });
    authMocks.signIn.mockResolvedValue({ redirectTo: "/dashboard" });
    authMocks.signUp.mockResolvedValue({ redirectTo: "/dashboard" });
  });

  it("renders login content with a password-recovery path", () => {
    renderWithProviders(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: /sign in to your workspace/i })).toBeTruthy();
    // The inline "Forgot password?" link is gone; recovery lives in the access panel.
    expect(screen.queryByRole("link", { name: /forgot password/i })).toBeNull();
    expect(screen.getByRole("link", { name: /reset password/i }).getAttribute("href")).toBe("/forgot-password");
  });

  it("pairs the sign-in form with an operational access panel, not product proof", () => {
    renderWithProviders(<AuthForm mode="login" />);
    // Operational access help fills the second column…
    expect(screen.getByTestId("auth-access-panel")).toBeTruthy();
    expect(screen.getByRole("link", { name: /request access/i }).getAttribute("href")).toBe("/request-access");
    expect(screen.getByRole("link", { name: /reset password/i }).getAttribute("href")).toBe("/forgot-password");
    // …with no staged product artifact or fake contract data.
    expect(screen.queryByTestId("auth-source-artifact")).toBeNull();
    expect(screen.queryByText(/master services agreement/i)).toBeNull();
    expect(screen.queryByText(/clause 12\.3/i)).toBeNull();
  });

  it("keeps the sign-in surface free of sales qualification and pricing", () => {
    renderWithProviders(<AuthForm mode="login" />);
    // Access help is operational, never sales: no pricing, no "need a workspace"
    // sales card, no marketing taglines or feature grid.
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.queryByText(/need a workspace/i)).toBeNull();
    expect(screen.queryByText(/core \$|per month|\/month/i)).toBeNull();
    expect(screen.queryByText(/contract tracking/i)).toBeNull();
    expect(screen.queryByText(/confirmed contract details become/i)).toBeNull();
    expect(screen.queryByText(/track tasks|collect evidence|export reports/i)).toBeNull();
    expect(screen.queryByText(/continue to contracts/i)).toBeNull();
  });

  it("surfaces only legally necessary policy links under the form", () => {
    renderWithProviders(<AuthForm mode="login" />);
    const nav = screen.getByRole("navigation", { name: /legal and policies/i });
    expect(nav).toBeTruthy();
    // Legal-min set is present…
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Accessibility" })).toBeTruthy();
    // …while broad marketing/navigation links are dropped.
    expect(screen.queryByRole("link", { name: "Contact" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Security" })).toBeNull();
  });

  it("toggles password visibility with an accessible control", () => {
    renderWithProviders(<AuthForm mode="login" />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");

    const toggle = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggle);

    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeTruthy();
  });

  it("submits login credentials once and navigates on the first successful response", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="login" />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    await user.type(email, "demo@example.com");
    await user.type(password, "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(authMocks.signIn).toHaveBeenCalledTimes(1));
    const submitted = authMocks.signIn.mock.calls[0][0];
    expect(submitted.get("email")).toBe("demo@example.com");
    expect(submitted.get("password")).toBe("correct-password");
    await waitFor(() => expect(authMocks.assignNavigableHref).toHaveBeenCalledWith("/dashboard"));
    expect(email.value).toBe("demo@example.com");
    expect(password.value).toBe("correct-password");
  });

  it("keeps typed credentials visible after a recoverable login rejection", async () => {
    authMocks.signIn.mockResolvedValueOnce({ error: "Sign-in could not be completed. Refresh the page and try again." });
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="login" />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    await user.type(email, "demo@example.com");
    await user.type(password, "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/sign-in could not be completed/i);
    expect(authMocks.assignNavigableHref).not.toHaveBeenCalled();
    expect(email.value).toBe("demo@example.com");
    expect(password.value).toBe("correct-password");
  });

  it("renders signup-specific full name field", () => {
    renderWithProviders(<AuthForm mode="signup" accessCode="grant_token" signupGrantState="valid_workspace_creation" />);
    expect(screen.getByLabelText("Full name")).toBeTruthy();
    expect(screen.getByLabelText(/Company name/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Access code/i)).toBeNull();
    expect(screen.getByRole("button", { name: /create workspace account/i })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/access link ready/i);
  });

  it("blocks signup without a grant and sends users to request access", () => {
    renderWithProviders(<AuthForm mode="signup" signupGrantState="missing" />);
    expect(screen.getByRole("heading", { name: /access link required/i })).toBeTruthy();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.getByRole("link", { name: /request access/i }).getAttribute("href")).toBe("/request-access");
  });

  it("renders revoked signup grants as a terminal recovery state", () => {
    renderWithProviders(<AuthForm mode="signup" accessCode="grant_token" signupGrantState="revoked" />);
    expect(screen.getByRole("heading", { name: /no longer active/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create workspace account/i })).toBeNull();
  });

  it("renders forgot-password mode", () => {
    renderWithProviders(<AuthForm mode="forgot-password" />);
    expect(screen.getByRole("heading", { name: /reset your password/i })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("renders reset-password mode with a confirmation field", () => {
    renderWithProviders(<AuthForm mode="reset-password" />);
    expect(screen.getByRole("heading", { name: /set a new password/i })).toBeTruthy();
    // The new-password label carries an inline "min 8" hint, so match on substring.
    expect(screen.getByLabelText(/New password/)).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
  });

  it("shows an invalid/expired reset-link state with a recovery path", () => {
    renderWithProviders(<AuthForm mode="reset-password" linkInvalid />);
    expect(screen.getByRole("heading", { name: /invalid or expired/i })).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    const recover = screen.getByRole("link", { name: /request a new link/i });
    expect(recover.getAttribute("href")).toBe("/forgot-password");
  });

  it("surfaces a completion card after a password reset request", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="forgot-password" />);
    await user.type(screen.getByLabelText("Email"), "demo@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    // Non-enumerating success: neutral copy never confirms the account exists.
    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeTruthy();
    expect(screen.getByText(/if an account exists for that address/i)).toBeTruthy();
    expect(authMocks.forgotPassword).toHaveBeenCalledTimes(1);
  });

  it("routes a denied signup toward request access", async () => {
    authMocks.signUp.mockResolvedValueOnce({
      error:
        "Signup requires approved workspace access. Request access if your team tracks what signed contracts require next.",
    });
    const user = userEvent.setup();
    renderWithProviders(<AuthForm mode="signup" accessCode="grant_token" signupGrantState="valid_workspace_creation" />);
    await user.type(screen.getByLabelText("Full name"), "Dana Lee");
    await user.type(screen.getByLabelText("Email"), "dana@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /create workspace account/i }));

    const link = await screen.findByRole("link", { name: /request access/i });
    expect(link.getAttribute("href")).toBe("/request-access");
  });
});
