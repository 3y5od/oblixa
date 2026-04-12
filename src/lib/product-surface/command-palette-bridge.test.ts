import { describe, expect, it } from "vitest";
import { COMMAND_PALETTE_OPEN_EVENT } from "./command-palette-bridge";

describe("command-palette-bridge", () => {
  it("uses a stable custom event name for palette opens", () => {
    expect(COMMAND_PALETTE_OPEN_EVENT).toBe("oblixa:command-palette-open");
  });
});
