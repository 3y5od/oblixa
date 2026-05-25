import { beforeEach, describe, expect, it, vi } from "vitest";

const assembleReviewBoardPacket = vi.fn();
const deliverReviewBoardRunNotifications = vi.fn();
const incrementAssuranceQualityCounter = vi.fn();

vi.mock("@/lib/assurance/review-boards", () => ({
  assembleReviewBoardPacket,
}));

vi.mock("@/lib/assurance/review-board-notifications", () => ({
  deliverReviewBoardRunNotifications,
}));

vi.mock("@/lib/assurance/telemetry", () => ({
  incrementAssuranceQualityCounter,
}));

describe("generateReviewBoardPackets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assembleReviewBoardPacket.mockResolvedValue({
      agenda_json: { sections: [] },
      packet_json: { summary: {} },
      unresolved_findings_json: [],
      errors: [],
    });
    deliverReviewBoardRunNotifications.mockResolvedValue({ attempted: 0, delivered: 0, errors: [] });
    incrementAssuranceQualityCounter.mockResolvedValue(undefined);
  });

  it("treats duplicate cron review-board run inserts as safe duplicate work", async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "review_boards") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [{ id: "board-1", name: "Board", subscriptions_json: [] }], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "review_board_runs") {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate slot" } }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const { generateReviewBoardPackets } = await import("@/lib/assurance/cron-jobs");
    const result = await generateReviewBoardPackets(admin as never, ["org-1"]);

    expect(result).toMatchObject({
      generated: 0,
      duplicateRunsSkipped: 1,
      orgsSucceeded: 1,
      orgsFailed: 0,
      errors: [],
    });
    expect(deliverReviewBoardRunNotifications).not.toHaveBeenCalled();
  });
});