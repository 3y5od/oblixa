import { describe, expect, it } from "vitest";
import { isNotificationAllowed } from "@/lib/notification-policy";

type AdminStub = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { notification_policy_json: Record<string, unknown> } | null }>;
      };
    };
  };
};

function makeAdminStub(policy: Record<string, unknown> | null): AdminStub {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: policy ? { notification_policy_json: policy } : null,
          }),
        }),
      }),
    }),
  };
}

describe("isNotificationAllowed", () => {
  it("allows notification when no policy exists", async () => {
    const admin = makeAdminStub(null);
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(true);
  });

  it("blocks when channel is disabled", async () => {
    const admin = makeAdminStub({
      email: { enabled: false },
    });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });

  it("blocks configured notification types", async () => {
    const admin = makeAdminStub({
      email: { blocked_types: ["reminder_due"] },
    });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });

  it("blocks during configured quiet hours", async () => {
    const hour = new Date().getUTCHours();
    const admin = makeAdminStub({
      email: {
        quiet_hours_start_utc: hour,
        quiet_hours_end_utc: (hour + 1) % 24,
      },
    });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });
});
