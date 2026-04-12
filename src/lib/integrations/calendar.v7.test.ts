import { describe, expect, it, vi } from "vitest";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";

function emptyAdmin() {
  const done = Promise.resolve({ data: [] as Array<Record<string, unknown>> });
  return {
    from: vi.fn((table: string) => {
      if (table === "contract_obligations") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                not: () => done,
              }),
            }),
          }),
        };
      }
      if (table === "contract_renewal_checkpoints") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => done,
            }),
          }),
        };
      }
      if (table === "contract_renewal_scenarios") {
        return {
          select: () => ({
            eq: () => ({
              in: () => done,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => done,
        }),
      };
    }),
  } as never;
}

describe("organization calendar ICS (V7 §AN)", () => {
  it("does not embed Advanced/Assurance dashboard URLs in VEVENT text for empty feeds", async () => {
    const ics = await buildOrganizationCalendarIcs(emptyAdmin(), "org-1");
    const lower = ics.toLowerCase();
    expect(lower).not.toContain("/decisions");
    expect(lower).not.toContain("/campaigns");
    expect(lower).not.toContain("/assurance");
    expect(lower).not.toContain("https://");
    expect(ics).toContain("BEGIN:VCALENDAR");
  });
});
