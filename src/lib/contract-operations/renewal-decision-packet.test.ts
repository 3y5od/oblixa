import { describe, expect, it } from "vitest";
import { buildRenewalDecisionPacketPayload, normalizeRenewalWorkspaceJson } from "@/lib/contract-operations/renewal-decision-packet";

describe("normalizeRenewalWorkspaceJson", () => {
  it("normalizes workspace fields", () => {
    const w = normalizeRenewalWorkspaceJson({
      stakeholder_checklist: [{ role: "Legal", item: "Review", done: true }],
      scenario_comparison: [{ name: "Renew", notes: "ok" }],
      commercial_notes: "Net 30",
      meeting_agenda: ["Intro"],
    });
    expect(w.stakeholder_checklist).toHaveLength(1);
    expect(w.scenario_comparison[0]?.name).toBe("Renew");
    expect(w.commercial_notes).toBe("Net 30");
    expect(w.meeting_agenda).toEqual(["Intro"]);
  });
});

describe("buildRenewalDecisionPacketPayload", () => {
  it("includes checkpoint, workspace, and scenario snapshot", () => {
    const { packet_json, assumptions_json } = buildRenewalDecisionPacketPayload({
      checkpoint: {
        label: "90d prep",
        due_date: "2026-06-01",
        status: "pending",
        renewal_state: "gathering_inputs",
        workspace_json: {
          commercial_notes: "Price uplift 5%",
          meeting_agenda: ["A", "B"],
        },
      },
      scenarioRow: {
        id: "scen-1",
        scenario: "renew",
        workspace_status: "in_review",
        target_decision_date: "2026-07-01",
        decision_date: null,
      },
      assumptionsFromRequest: { foo: "bar" },
    });
    expect(packet_json.snapshot_version).toBe(1);
    expect(packet_json.checkpoint_label).toBe("90d prep");
    expect(packet_json.renewal_state).toBe("gathering_inputs");
    expect((packet_json.workspace as { commercial_notes: string }).commercial_notes).toBe("Price uplift 5%");
    expect(packet_json.linked_renewal_scenario).toMatchObject({ id: "scen-1", scenario: "renew" });
    expect(assumptions_json.foo).toBe("bar");
    expect(assumptions_json.commercial_notes_from_workspace).toBe("Price uplift 5%");
  });

  it("omits scenario block when none linked", () => {
    const { packet_json } = buildRenewalDecisionPacketPayload({
      checkpoint: {
        label: "x",
        due_date: null,
        status: "pending",
        renewal_state: "not_started",
        workspace_json: {},
      },
    });
    expect(packet_json.linked_renewal_scenario).toBeUndefined();
  });
});
