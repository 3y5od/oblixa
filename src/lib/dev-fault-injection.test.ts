import { afterEach, describe, expect, it } from "vitest";
import { maybeThrowFaultInjection } from "./dev-fault-injection";

describe("TEST_FAULT_INJECTION hook", () => {
  afterEach(() => {
    delete process.env.TEST_FAULT_INJECTION;
  });

  it("is inert when env unset", () => {
    expect(() => maybeThrowFaultInjection()).not.toThrow();
  });

  it("throws when TEST_FAULT_INJECTION=1", () => {
    process.env.TEST_FAULT_INJECTION = "1";
    expect(() => maybeThrowFaultInjection()).toThrow(/FAULT_INJECTION/);
  });
});
