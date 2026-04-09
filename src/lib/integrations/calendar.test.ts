import { describe, expect, it } from "vitest";
import { buildOrganizationCalendarIcs } from "@/lib/integrations/calendar";

type QueryResult = { data: Array<Record<string, unknown>> };

function createAdminStub(results: Record<string, QueryResult>) {
  return {
    from: (table: string) => {
      const query = Promise.resolve(results[table] ?? { data: [] });
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        not: () => chain,
        then: query.then.bind(query),
        catch: query.catch.bind(query),
        finally: query.finally.bind(query),
      };
      return chain;
    },
  };
}

describe("buildOrganizationCalendarIcs", () => {
  it("includes renewal decision date events for active scenarios", async () => {
    const admin = createAdminStub({
      reminders: { data: [] },
      contract_obligations: { data: [] },
      contract_renewal_checkpoints: { data: [] },
      contract_renewal_scenarios: {
        data: [
          {
            id: "scenario-1",
            decision_date: null,
            target_decision_date: "2026-08-20",
            workspace_status: "recommended",
            contracts: { id: "contract-1", title: "Acme MSA", organization_id: "org-1" },
          },
        ],
      },
    });
    const ics = await buildOrganizationCalendarIcs(admin as never, "org-1");
    expect(ics).toContain("SUMMARY:Renewal decision date");
    expect(ics).toContain("UID:renewal-decision-scenario-1@oblixa.io");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260820");
  });

  it("skips renewal decision event when decision date is missing", async () => {
    const admin = createAdminStub({
      reminders: { data: [] },
      contract_obligations: { data: [] },
      contract_renewal_checkpoints: { data: [] },
      contract_renewal_scenarios: {
        data: [
          {
            id: "scenario-2",
            decision_date: null,
            target_decision_date: null,
            workspace_status: "draft",
            contracts: { id: "contract-2", title: "No Date", organization_id: "org-1" },
          },
        ],
      },
    });
    const ics = await buildOrganizationCalendarIcs(admin as never, "org-1");
    expect(ics).not.toContain("renewal-decision-scenario-2@oblixa.io");
  });
});
