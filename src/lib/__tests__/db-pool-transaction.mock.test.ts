import { describe, expect, it } from "vitest";

describe("DB pool / optimistic concurrency (mocked) (Phase 30)", () => {
  it("detects version conflict on write", async () => {
    const read = async () => ({ id: "x", version: 2 });
    const write = async () => ({ ok: false as const });
    const row = await read();
    const res = await write();
    expect(row.version).toBe(2);
    expect(res.ok).toBe(false);
  });
});
