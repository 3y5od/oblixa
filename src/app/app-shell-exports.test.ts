import { describe, expect, it } from "vitest";

describe("app shell default exports", () => {
  it("dashboard error segment defines a default export", async () => {
    const mod = await import("@/app/(dashboard)/error");
    expect(typeof mod.default).toBe("function");
  });

  it("marketing error segment defines a default export", async () => {
    const mod = await import("@/app/(marketing)/error");
    expect(typeof mod.default).toBe("function");
  });
});
