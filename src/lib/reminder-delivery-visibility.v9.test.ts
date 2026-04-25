import { describe, expect, it } from "vitest";
import {
  getReminderDeliveryState,
  groupReminderDeliveriesByReminderId,
} from "./reminder-delivery-visibility";

describe("reminder delivery visibility", () => {
  it("groups delivery attempts by reminder id", () => {
    const grouped = groupReminderDeliveriesByReminderId([
      {
        status: "failed",
        created_at: "2026-04-17T10:00:00.000Z",
        metadata: { reminder_id: "r1" },
      },
      {
        status: "delivered",
        created_at: "2026-04-17T11:00:00.000Z",
        metadata: { reminder_id: "r1" },
      },
    ]);

    expect(grouped.r1).toHaveLength(2);
    expect(getReminderDeliveryState(grouped.r1).label).toBe("Delivered");
  });

  it("surfaces failure copy when the latest attempt failed", () => {
    const state = getReminderDeliveryState([
      {
        status: "failed",
        created_at: "2026-04-17T11:00:00.000Z",
        last_error: "smtp rejected recipient",
        metadata: { reminder_id: "r1" },
      },
    ]);

    expect(state.tone).toBe("risk");
    expect(state.label).toBe("Failed");
    expect(state.detail).toContain("smtp rejected recipient");
  });

  it("surfaces suppression reasons when they are recorded", () => {
    const state = getReminderDeliveryState([
      {
        status: "suppressed",
        created_at: "2026-04-17T11:00:00.000Z",
        metadata: { reminder_id: "r1", suppression_reason: "missing_approved_dates" },
      },
    ]);

    expect(state.tone).toBe("attention");
    expect(state.label).toBe("Suppressed");
    expect(state.detail).toContain("approved dates are still missing");
  });

  it("explains retry scheduling when the latest attempt is retrying", () => {
    const state = getReminderDeliveryState([
      {
        status: "retrying",
        created_at: "2026-04-17T11:00:00.000Z",
        next_attempt_at: "2026-04-17T12:00:00.000Z",
        last_error: "[terminal] smtp timeout",
        metadata: { reminder_id: "r1" },
      },
    ]);

    expect(state.label).toBe("Retrying");
    expect(state.detail).toContain("smtp timeout");
    expect(state.detail).toContain("2026-04-17T12:00:00.000Z");
  });
});
