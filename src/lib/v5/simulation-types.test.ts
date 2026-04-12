import { describe, expect, it } from "vitest";
import {
  SIMULATION_TYPES,
  SIMULATION_TYPE_FOCUS,
  isValidSimulationType,
  simulationTypeValidationError,
} from "@/lib/v5/simulation-types";

describe("simulation-types", () => {
  it("SIMULATION_TYPE_FOCUS keys match SIMULATION_TYPES exactly", () => {
    expect(Object.keys(SIMULATION_TYPE_FOCUS).length).toBe(SIMULATION_TYPES.length);
    for (const t of SIMULATION_TYPES) {
      expect(typeof SIMULATION_TYPE_FOCUS[t]).toBe("string");
      expect(SIMULATION_TYPE_FOCUS[t].length).toBeGreaterThan(0);
    }
  });

  it("isValidSimulationType and error string", () => {
    expect(isValidSimulationType("campaign_eligibility_impact")).toBe(true);
    expect(isValidSimulationType("nope")).toBe(false);
    expect(simulationTypeValidationError()).toContain("program_update_impact");
  });
});
