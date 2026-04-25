import { describe, expect, it } from "vitest";
import {
  resolveFeatureMappingForAction,
  resolveFeatureMappingForApiPath,
  resolveFeatureMappingForPagePath,
} from "@/lib/product-surface/v8-surface-mapping";

describe("v8 surface mapping", () => {
  it("maps known governed page path", () => {
    const mapping = resolveFeatureMappingForPagePath("/contracts");
    expect(mapping.status).toBe("mapped");
    if (mapping.status === "mapped") {
      expect(mapping.featureFamily).toBe("contracts");
    }
  });

  it("classifies known exempt api path", () => {
    const mapping = resolveFeatureMappingForApiPath("/api/cron/v4/reminders");
    expect(mapping.status).toBe("exempt");
    if (mapping.status === "exempt") {
      expect(mapping.exemptClass).toBe("cron");
    }
  });

  it("maps known server action identifier", () => {
    const mapping = resolveFeatureMappingForAction("src/actions/contracts.ts:createContract");
    expect(mapping.status).toBe("mapped");
  });

  it("classifies root marketing page as exempt", () => {
    const mapping = resolveFeatureMappingForPagePath("/");
    expect(mapping.status).toBe("exempt");
    if (mapping.status === "exempt") {
      expect(mapping.exemptClass).toBe("legal_marketing");
    }
  });

  it("maps action modules by file base before fallback heuristics", () => {
    const mapping = resolveFeatureMappingForAction("src/actions/tasks.ts:createContractTask");
    expect(mapping.status).toBe("mapped");
    if (mapping.status === "mapped") {
      expect(mapping.featureFamily).toBe("work");
    }
  });

  it("maps exception actions to the exceptions family", () => {
    const mapping = resolveFeatureMappingForAction("src/actions/exceptions.ts:createExceptionRequest");
    expect(mapping.status).toBe("mapped");
    if (mapping.status === "mapped") {
      expect(mapping.featureFamily).toBe("exceptions");
    }
  });
});
