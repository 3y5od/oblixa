import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isStepUpCookieValidForUser,
  mintStepUpCookieValue,
  STEP_UP_COOKIE_NAME,
} from "@/lib/security/step-up-cookie";

describe("step-up-cookie", () => {
  const prev = process.env.OBLIXA_STEP_UP_SECRET;
  beforeEach(() => {
    process.env.OBLIXA_STEP_UP_SECRET = "unit_test_step_up_secret_32b";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.OBLIXA_STEP_UP_SECRET;
    else process.env.OBLIXA_STEP_UP_SECRET = prev;
  });

  it("mints and validates a cookie for the same user", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const v = mintStepUpCookieValue(uid);
    expect(v.length).toBeGreaterThan(20);
    const jar = { get: (name: string) => (name === STEP_UP_COOKIE_NAME ? { value: v } : undefined) };
    expect(isStepUpCookieValidForUser(jar, uid)).toBe(true);
    expect(isStepUpCookieValidForUser(jar, "22222222-2222-2222-2222-222222222222")).toBe(false);
  });
});
