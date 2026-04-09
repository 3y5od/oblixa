import { describe, expect, it } from "vitest";
import { recomputeContractSignals } from "@/lib/workflow-signals";
import type { createAdminClient } from "@/lib/supabase/server";

describe("recomputeContractSignals", () => {
  it("returns contract_not_found when contract lookup misses", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof createAdminClient>>;

    const result = await recomputeContractSignals(admin, "11111111-1111-1111-1111-111111111111");
    expect(result).toEqual({ ok: false, reason: "contract_not_found" });
  });
});
