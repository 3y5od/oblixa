import { beforeEach, describe, expect, it, vi } from "vitest";

const cookies = vi.fn();
const isStepUpCookieValidForUser = vi.fn();

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("@/lib/security/step-up-cookie", () => ({
  isStepUpCookieValidForUser,
}));

describe("hasSensitiveActionProof", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookies.mockResolvedValue({ get: vi.fn() });
    isStepUpCookieValidForUser.mockReturnValue(false);
  });

  it("accepts a valid step-up cookie before checking AAL", async () => {
    isStepUpCookieValidForUser.mockReturnValue(true);
    const getAuthenticatorAssuranceLevel = vi.fn();
    const { hasSensitiveActionProof } = await import("./sensitive-action-proof");

    await expect(
      hasSensitiveActionProof({ auth: { mfa: { getAuthenticatorAssuranceLevel } } }, "user-1")
    ).resolves.toBe(true);
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("accepts current AAL2 when the step-up cookie is absent", async () => {
    const { hasSensitiveActionProof } = await import("./sensitive-action-proof");

    await expect(
      hasSensitiveActionProof(
        {
          auth: {
            mfa: {
              getAuthenticatorAssuranceLevel: vi.fn(async () => ({
                data: { currentLevel: "aal2" },
              })),
            },
          },
        },
        "user-1"
      )
    ).resolves.toBe(true);
  });

  it("fails closed when neither proof is available", async () => {
    const { hasSensitiveActionProof } = await import("./sensitive-action-proof");

    await expect(
      hasSensitiveActionProof(
        {
          auth: {
            mfa: {
              getAuthenticatorAssuranceLevel: vi.fn(async () => ({
                data: { currentLevel: "aal1" },
              })),
            },
          },
        },
        "user-1"
      )
    ).resolves.toBe(false);
  });

  it("fails closed when proof lookup throws", async () => {
    cookies.mockRejectedValueOnce(new Error("cookie store unavailable"));
    const { hasSensitiveActionProof } = await import("./sensitive-action-proof");

    await expect(
      hasSensitiveActionProof(
        {
          auth: {
            mfa: {
              getAuthenticatorAssuranceLevel: vi.fn(async () => ({
                data: { currentLevel: "aal2" },
              })),
            },
          },
        },
        "user-1"
      )
    ).resolves.toBe(false);
  });
});
