import { describe, expect, it } from "vitest";
import { isNotificationAllowed } from "@/lib/notification-policy";

type AdminStub = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<
          | { data: { notification_policy_json?: Record<string, unknown>; v6_org_settings_json?: unknown } | null }
          | { data: null }
        >;
      };
    };
  };
};

function makeAdminStub(
  policy: Record<string, unknown> | null,
  v6OrgSettings: Record<string, unknown> = {}
): AdminStub {
  return {
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { v6_org_settings_json: v6OrgSettings },
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: policy ? { notification_policy_json: policy } : null,
            }),
          }),
        }),
      };
    },
  };
}

describe("isNotificationAllowed", () => {
  it("allows notification when no policy exists", async () => {
    const admin = makeAdminStub(null, { workspace_mode: "core" });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(true);
  });

  it("blocks when channel is disabled", async () => {
    const admin = makeAdminStub(
      {
        email: { enabled: false },
      },
      { workspace_mode: "core" }
    );
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });

  it("blocks configured notification types", async () => {
    const admin = makeAdminStub(
      {
        email: { blocked_types: ["reminder_due"] },
      },
      { workspace_mode: "core" }
    );
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });

  it("blocks during configured quiet hours", async () => {
    const hour = new Date().getUTCHours();
    const admin = makeAdminStub(
      {
        email: {
          quiet_hours_start_utc: hour,
          quiet_hours_end_utc: (hour + 1) % 24,
        },
      },
      { workspace_mode: "core" }
    );
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
    });
    expect(allowed).toBe(false);
  });

  it("blocks advanced-tier notification types in core workspace mode", async () => {
    const admin = makeAdminStub({ email: {} }, { workspace_mode: "core" });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "campaign_digest",
    });
    expect(allowed).toBe(false);
  });

  it("allows advanced-tier notifications when workspace is advanced", async () => {
    const admin = makeAdminStub({ email: {} }, { workspace_mode: "advanced" });
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "campaign_digest",
    });
    expect(allowed).toBe(true);
  });

  it("blocks advanced notification when matching module is hidden", async () => {
    const admin = makeAdminStub(
      { email: {} },
      { workspace_mode: "advanced", advanced_modules_hidden: ["campaigns"] }
    );
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "campaign_digest",
    });
    expect(allowed).toBe(false);
  });

  it("blocks assurance notification when matching module is hidden", async () => {
    const admin = makeAdminStub(
      { email: {} },
      { workspace_mode: "assurance", assurance_modules_hidden: ["review_boards"] }
    );
    const allowed = await isNotificationAllowed(admin as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "review_board_packet",
    });
    expect(allowed).toBe(false);
  });
});
