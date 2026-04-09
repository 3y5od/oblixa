import { afterEach, describe, expect, it } from "vitest";
import { getSentryRelease } from "@/lib/observability/sentry-release";

describe("getSentryRelease", () => {
  const keys = [
    "SENTRY_RELEASE",
    "NEXT_PUBLIC_SENTRY_RELEASE",
    "VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
  ] as const;

  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it("prefers SENTRY_RELEASE", () => {
    process.env.SENTRY_RELEASE = "rel-a";
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = "rel-b";
    expect(getSentryRelease()).toBe("rel-a");
  });

  it("falls back to NEXT_PUBLIC_SENTRY_RELEASE", () => {
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = "rel-b";
    expect(getSentryRelease()).toBe("rel-b");
  });

  it("falls back to VERCEL_GIT_COMMIT_SHA", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "abc123";
    expect(getSentryRelease()).toBe("abc123");
  });

  it("falls back to GITHUB_SHA", () => {
    process.env.GITHUB_SHA = "def456";
    expect(getSentryRelease()).toBe("def456");
  });

  it("trims whitespace", () => {
    process.env.SENTRY_RELEASE = "  v1  ";
    expect(getSentryRelease()).toBe("v1");
  });

  it("returns undefined when unset", () => {
    expect(getSentryRelease()).toBeUndefined();
  });
});
