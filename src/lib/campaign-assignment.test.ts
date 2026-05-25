import { describe, expect, it } from "vitest";
import {
  computeRowAssignedTeamPatch,
  parseCampaignAssignmentJson,
  resolveCampaignTaskRouting,
} from "./decision-intelligence/campaign-assignment";

describe("parseCampaignAssignmentJson", () => {
  it("accepts empty object", () => {
    const r = parseCampaignAssignmentJson({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({});
  });

  it("rejects arrays", () => {
    const r = parseCampaignAssignmentJson([]);
    expect(r.ok).toBe(false);
  });

  it("parses full shape", () => {
    const r = parseCampaignAssignmentJson({
      defaultTeamKey: " legal ",
      defaultAssigneeId: "550e8400-e29b-41d4-a716-446655440000",
      bySegment: {
        east: { teamKey: "ops", assigneeId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.defaultTeamKey).toBe("legal");
      expect(r.value.bySegment?.east?.teamKey).toBe("ops");
    }
  });

  it("rejects bad uuid", () => {
    const r = parseCampaignAssignmentJson({ defaultAssigneeId: "not-a-uuid" });
    expect(r.ok).toBe(false);
  });
});

describe("resolveCampaignTaskRouting", () => {
  it("uses row team first", () => {
    const r = resolveCampaignTaskRouting({
      segmentKey: "east",
      assignedTeam: "finance",
      assignment: { defaultTeamKey: "ops", bySegment: { east: { teamKey: "legal" } } },
    });
    expect(r.teamKey).toBe("finance");
  });

  it("uses bySegment then default then ops", () => {
    expect(
      resolveCampaignTaskRouting({
        segmentKey: "east",
        assignedTeam: null,
        assignment: { bySegment: { east: { teamKey: "legal" } } },
      }).teamKey
    ).toBe("legal");

    expect(
      resolveCampaignTaskRouting({
        segmentKey: "west",
        assignedTeam: "",
        assignment: { defaultTeamKey: "ops" },
      }).teamKey
    ).toBe("ops");

    expect(
      resolveCampaignTaskRouting({
        segmentKey: null,
        assignedTeam: null,
        assignment: {},
      }).teamKey
    ).toBe("ops");
  });

  it("resolves assignee from segment and default", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      resolveCampaignTaskRouting({
        segmentKey: "east",
        assignedTeam: null,
        assignment: { bySegment: { east: { assigneeId: id } } },
      }).assigneeId
    ).toBe(id);

    expect(
      resolveCampaignTaskRouting({
        segmentKey: null,
        assignedTeam: null,
        assignment: { defaultAssigneeId: id },
      }).assigneeId
    ).toBe(id);
  });
});

describe("computeRowAssignedTeamPatch", () => {
  it("returns null when row has team", () => {
    expect(
      computeRowAssignedTeamPatch(
        { segment_key: "a", assigned_team: "x" },
        { defaultTeamKey: "ops" }
      )
    ).toBeNull();
  });

  it("uses bySegment then default", () => {
    expect(
      computeRowAssignedTeamPatch({ segment_key: "a", assigned_team: null }, {
        bySegment: { a: { teamKey: "legal" } },
      })
    ).toBe("legal");

    expect(
      computeRowAssignedTeamPatch({ segment_key: null, assigned_team: null }, {
        defaultTeamKey: "ops",
      })
    ).toBe("ops");
  });
});
