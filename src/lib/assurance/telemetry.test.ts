import { describe, expect, it, vi } from "vitest";
import { recordAssuranceActivity } from "./telemetry";

describe("recordAssuranceActivity", () => {
  it("updates existing org_behavior_metrics row when present", async () => {
    let fromCalls = 0;
    const admin = {
      from: vi.fn(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "m1", v6_assurance_quality_json: { prior: true } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        const update = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: async () => ({ error: null }),
          }),
        });
        return { update };
      }),
    } as never;

    await recordAssuranceActivity(admin, "org-1", { checks_run: 3 });
    expect(fromCalls).toBe(2);
  });

  it("inserts when no row for metrics_date", async () => {
    let fromCalls = 0;
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return { insert };
      }),
    } as never;

    await recordAssuranceActivity(admin, "org-2", { foo: "bar" });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-2",
        v6_assurance_quality_json: expect.objectContaining({ foo: "bar" }),
      })
    );
  });
});
