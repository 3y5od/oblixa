import { describe, expect, it, vi } from "vitest";
import { assignNavigableHref, normalizeAppHref, pushAppHref, replaceAppHref } from "./client-navigation";

describe("client-navigation", () => {
  it("normalizes same-origin app destinations and rejects off-origin ones", () => {
    expect(normalizeAppHref("/dashboard")).toBe("/dashboard");
    expect(normalizeAppHref("https://app.example/contracts/1?tab=files", "https://app.example")).toBe(
      "/contracts/1?tab=files"
    );
    expect(normalizeAppHref("https://stripe.com/checkout", "https://app.example")).toBeNull();
  });

  it("pushes and replaces only normalized in-app hrefs", () => {
    const push = vi.fn();
    const replace = vi.fn();

    expect(pushAppHref({ push }, "/reports")).toBe(true);
    expect(push).toHaveBeenCalledWith("/reports");

    expect(replaceAppHref({ replace }, "https://app.example/settings/product", "https://app.example")).toBe(true);
    expect(replace).toHaveBeenCalledWith("/settings/product");

    expect(pushAppHref({ push }, "https://example.com/out", "https://app.example")).toBe(false);
  });

  it("assigns internal and external safe hrefs while rejecting unsafe protocols", () => {
    const assign = vi.fn();

    expect(assignNavigableHref("/dashboard", assign, "https://app.example")).toBe(true);
    expect(assignNavigableHref("https://app.example/reset-password?token=1", assign, "https://app.example")).toBe(true);
    expect(assignNavigableHref("https://billing.stripe.com/p/session_123", assign, "https://app.example")).toBe(true);
    expect(assignNavigableHref("javascript:alert(1)", assign, "https://app.example")).toBe(false);

    expect(assign.mock.calls).toEqual([
      ["/dashboard"],
      ["/reset-password?token=1"],
      ["https://billing.stripe.com/p/session_123"],
    ]);
  });
});