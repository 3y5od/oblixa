import { describe, expect, it } from "vitest";
import {
  EXTERNAL_ACTION_TYPES,
  externalActionTypeValidationError,
  isValidExternalActionType,
} from "@/lib/decision-intelligence/external-action-types";

describe("external-action-types", () => {
  it("isValidExternalActionType accepts only known types", () => {
    for (const t of EXTERNAL_ACTION_TYPES) {
      expect(isValidExternalActionType(t)).toBe(true);
    }
    expect(isValidExternalActionType("unknown_type")).toBe(false);
    expect(isValidExternalActionType("")).toBe(false);
  });

  it("externalActionTypeValidationError lists allowed values", () => {
    const msg = externalActionTypeValidationError();
    for (const t of EXTERNAL_ACTION_TYPES) {
      expect(msg).toContain(t);
    }
  });
});
