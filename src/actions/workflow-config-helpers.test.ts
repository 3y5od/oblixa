import { describe, expect, it } from "vitest";

import {
  MAX_WORKFLOW_CSV_ITEMS,
  normalizeApiKeyScopes,
  normalizeOptionalExpiryIso,
  parseWorkflowHttpsUrl,
  parseWorkflowJsonObject,
  parseWorkflowStrictInt,
  parseWorkflowTokenCsv,
  readWorkflowEnum,
  readWorkflowString,
  textInputError,
  WORKFLOW_INTEGRATION_PROVIDERS,
} from "@/actions/workflow-config-helpers";

describe("workflow config helper validation", () => {
  it("accepts only credential-free HTTPS webhook URLs and strips fragments", () => {
    expect(parseWorkflowHttpsUrl("https://example.com/hook#secret")).toEqual({
      ok: true,
      value: "https://example.com/hook",
    });
    expect(parseWorkflowHttpsUrl("http://example.com/hook")).toEqual({
      ok: false,
      error: "Webhook URL must use HTTPS",
    });
    expect(parseWorkflowHttpsUrl("https://user:pass@example.com/hook")).toEqual({
      ok: false,
      error: "Webhook URL must not include credentials",
    });
  });

  it("rejects unsafe JSON keys and oversized workflow JSON shapes", () => {
    expect(parseWorkflowJsonObject('{"safe":true}')).toEqual({ ok: true, value: { safe: true } });
    expect(parseWorkflowJsonObject('{"__proto__":{"polluted":true}}')).toEqual({ ok: false });
    expect(
      parseWorkflowJsonObject(JSON.stringify({ value: "x".repeat(10) }), { maxStringLength: 4 })
    ).toEqual({ ok: false });
  });

  it("bounds workflow tokens, integers, and enum values", () => {
    expect(parseWorkflowTokenCsv("events:read,events:read,calendar.sync")).toEqual({
      ok: true,
      values: ["events:read", "calendar.sync"],
    });
    expect(parseWorkflowTokenCsv("events read")).toEqual({ ok: false });
    expect(parseWorkflowTokenCsv(Array.from({ length: MAX_WORKFLOW_CSV_ITEMS + 1 }, (_, index) => `item${index}`).join(","))).toEqual({ ok: false });

    const formData = new FormData();
    formData.set("provider", "slack");
    formData.set("days", "999");
    expect(readWorkflowEnum(formData, "provider", WORKFLOW_INTEGRATION_PROVIDERS)).toBe("slack");
    expect(parseWorkflowStrictInt(formData, "days", { min: 1, max: 30 })).toBe(30);
  });

  it("normalizes optional expiries and API scopes without expanding privileges", () => {
    expect(normalizeOptionalExpiryIso(null)).toEqual({ ok: true, value: null });
    expect(normalizeApiKeyScopes(["events:read", "admin:write"])).toEqual(["events:read"]);
    expect(normalizeApiKeyScopes([])).toEqual(["events:read"]);
  });

  it("returns field-specific safe validation messages", () => {
    const formData = new FormData();
    formData.set("label", "x".repeat(4));
    const result = readWorkflowString(formData, "label", { maxLength: 2 });

    expect(result).toEqual({ ok: false, error: "string_too_long" });
    if (!result.ok) expect(textInputError("Label", result)).toBe("Label is too long");
  });
});
