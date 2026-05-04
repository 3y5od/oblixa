import { beforeEach, describe, expect, it, vi } from "vitest";

type DeliveryRow = {
  id: string;
  organization_id: string;
  channel: "email" | "slack";
  notification_type: string;
  recipient: string | null;
  subject: string | null;
  status: "pending" | "retrying" | "delivered" | "failed" | "suppressed";
  attempt_count: number;
  metadata: Record<string, unknown> | null;
  next_attempt_at: string | null;
  delivered_at: string | null;
  last_error: string | null;
  created_at: string;
};

const sendReminderEmailMock = vi.fn();
const sendSavedViewSummaryEmailMock = vi.fn();
const safeFetchMock = vi.fn();

vi.mock("@/lib/email", () => ({
  sendReminderEmail: sendReminderEmailMock,
  sendSavedViewSummaryEmail: sendSavedViewSummaryEmailMock,
}));

vi.mock("@/lib/security/safe-fetch", () => ({
  safeFetch: safeFetchMock,
}));

vi.mock("@/lib/security/url-policy", () => ({
  validateOutboundHttpUrl: (url: string) => new URL(url),
}));

class DeliveryQuery {
  private eqFilters = new Map<string, unknown>();
  private inFilters = new Map<string, unknown[]>();
  private orFilter: string | null = null;
  private selected: string | null = null;
  private limitCount: number | null = null;
  private orderBy: { field: string; ascending: boolean } | null = null;

  constructor(
    private rows: DeliveryRow[],
    private action: "select" | "insert" | "update",
    private payload?: Record<string, unknown> | Record<string, unknown>[]
  ) {}

  select(columns: string) {
    this.selected = columns;
    return this;
  }

  eq(field: string, value: unknown) {
    this.eqFilters.set(field, value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.inFilters.set(field, values);
    return this;
  }

  or(expression: string) {
    this.orFilter = expression;
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderBy = { field, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async maybeSingle() {
    const result = await this.exec();
    const first = result.data?.[0] ?? null;
    return { data: first };
  }

  then<TResult1 = { data: Record<string, unknown>[] | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[] | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.exec().then(onfulfilled, onrejected);
  }

  private matches(row: DeliveryRow): boolean {
    for (const [field, value] of this.eqFilters.entries()) {
      if ((row as unknown as Record<string, unknown>)[field] !== value) return false;
    }
    for (const [field, values] of this.inFilters.entries()) {
      if (!values.includes((row as unknown as Record<string, unknown>)[field])) return false;
    }
    if (!this.orFilter) return true;
    const terms = this.orFilter.split(",");
    return terms.some((term) => {
      if (term === "next_attempt_at.is.null") return row.next_attempt_at == null;
      if (term.startsWith("next_attempt_at.lte.")) {
        const iso = term.slice("next_attempt_at.lte.".length);
        if (!row.next_attempt_at) return false;
        return new Date(row.next_attempt_at).getTime() <= new Date(iso).getTime();
      }
      return false;
    });
  }

  private project(row: DeliveryRow): Record<string, unknown> {
    if (!this.selected) return { ...row };
    const fields = this.selected.split(",").map((s) => s.trim());
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      out[field] = (row as unknown as Record<string, unknown>)[field];
    }
    return out;
  }

  private async exec(): Promise<{ data: Record<string, unknown>[] | null }> {
    if (this.action === "insert") {
      const payload = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted: Record<string, unknown>[] = [];
      for (const raw of payload) {
        const id = String(raw.id ?? `row-${this.rows.length + 1}`);
        const row: DeliveryRow = {
          id,
          organization_id: String(raw.organization_id),
          channel: String(raw.channel) as "email" | "slack",
          notification_type: String(raw.notification_type),
          recipient: (raw.recipient as string | null) ?? null,
          subject: (raw.subject as string | null) ?? null,
          status: String(raw.status) as DeliveryRow["status"],
          attempt_count: Number(raw.attempt_count ?? 0),
          metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
          next_attempt_at: (raw.next_attempt_at as string | null) ?? null,
          delivered_at: (raw.delivered_at as string | null) ?? null,
          last_error: (raw.last_error as string | null) ?? null,
          created_at: new Date().toISOString(),
        };
        this.rows.push(row);
        inserted.push(this.project(row));
      }
      return { data: inserted };
    }

    const matched = this.rows.filter((row) => this.matches(row));
    if (this.action === "update") {
      const patch = (this.payload ?? {}) as Record<string, unknown>;
      for (const row of matched) {
        Object.assign(row, patch);
      }
    }
    let resultRows = matched.slice();
    if (this.orderBy) {
      const { field, ascending } = this.orderBy;
      resultRows.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[field];
        const bv = (b as unknown as Record<string, unknown>)[field];
        return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    if (this.limitCount != null) resultRows = resultRows.slice(0, this.limitCount);
    return { data: resultRows.map((row) => this.project(row)) };
  }
}

function createFakeAdmin(initialRows: DeliveryRow[]) {
  const rows = initialRows;
  return {
    rows,
    client: {
      from: (table: string) => {
        if (table !== "notification_deliveries") throw new Error(`Unexpected table: ${table}`);
        return {
          select: (columns: string) => new DeliveryQuery(rows, "select").select(columns),
          insert: (payload: Record<string, unknown> | Record<string, unknown>[]) =>
            new DeliveryQuery(rows, "insert", payload),
          update: (payload: Record<string, unknown>) => new DeliveryQuery(rows, "update", payload),
        };
      },
    },
  };
}

describe("notification-delivery", () => {
  beforeEach(() => {
    sendReminderEmailMock.mockReset();
    sendSavedViewSummaryEmailMock.mockReset();
    safeFetchMock.mockReset();
  });

  it("fails poison messages without retry payload when max attempts reached", async () => {
    const now = new Date().toISOString();
    const { processNotificationDeliveryRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([
      {
        id: "d1",
        organization_id: "org-1",
        channel: "email",
        notification_type: "reminder_due",
        recipient: "ops@example.com",
        subject: "Reminder",
        status: "pending",
        attempt_count: 0,
        metadata: { max_attempts: 1, retry_payload: null },
        next_attempt_at: now,
        delivered_at: null,
        last_error: null,
        created_at: now,
      },
    ]);

    const summary = await processNotificationDeliveryRetries(client as never, { limit: 10 });
    expect(summary.failed).toBe(1);
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.attempt_count).toBe(1);
    expect(rows[0]?.last_error).toContain("missing_retry_payload");
  });

  it("uses lock semantics so overlapping workers do not duplicate sends", async () => {
    const now = new Date().toISOString();
    sendReminderEmailMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 25))
    );
    const { processNotificationDeliveryRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([
      {
        id: "d1",
        organization_id: "org-1",
        channel: "email",
        notification_type: "reminder_due",
        recipient: "ops@example.com",
        subject: "Reminder",
        status: "pending",
        attempt_count: 0,
        metadata: {
          max_attempts: 3,
          retry_payload: {
            kind: "reminder_due",
            to: "ops@example.com",
            contractTitle: "Test Contract",
            fieldName: "renewal_date",
            fieldValue: "2026-02-01",
            daysUntil: 20,
            contractUrl: "https://app/contracts/1",
          },
        },
        next_attempt_at: now,
        delivered_at: null,
        last_error: null,
        created_at: now,
      },
    ]);

    const [a, b] = await Promise.all([
      processNotificationDeliveryRetries(client as never, { limit: 10 }),
      processNotificationDeliveryRetries(client as never, { limit: 10 }),
    ]);
    expect(sendReminderEmailMock).toHaveBeenCalledTimes(1);
    expect(rows[0]?.status).toBe("delivered");
    expect(rows[0]?.attempt_count).toBe(1);
    expect(a.scanned + b.scanned).toBeGreaterThan(0);
    expect(a.skipped + b.skipped).toBeGreaterThanOrEqual(0);
  });

  it("clamps max attempts to 5 for repeated failures", async () => {
    const now = new Date().toISOString();
    sendReminderEmailMock.mockResolvedValue({ error: new Error("smtp_503") });
    const { processNotificationDeliveryRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([
      {
        id: "d1",
        organization_id: "org-1",
        channel: "email",
        notification_type: "reminder_due",
        recipient: "ops@example.com",
        subject: "Reminder",
        status: "pending",
        attempt_count: 0,
        metadata: {
          max_attempts: 100,
          retry_payload: {
            kind: "reminder_due",
            to: "ops@example.com",
            contractTitle: "Test Contract",
            fieldName: "renewal_date",
            fieldValue: "2026-02-01",
            daysUntil: 20,
            contractUrl: "https://app/contracts/1",
          },
        },
        next_attempt_at: now,
        delivered_at: null,
        last_error: null,
        created_at: now,
      },
    ]);

    for (let i = 0; i < 6; i++) {
      rows[0]!.next_attempt_at = new Date().toISOString();
      await processNotificationDeliveryRetries(client as never, { limit: 10 });
    }
    expect(rows[0]?.attempt_count).toBe(5);
    expect(rows[0]?.status).toBe("failed");
  });

  it("sanitizes stored metadata and retry payload sizes", async () => {
    sendReminderEmailMock.mockResolvedValue({ error: null });
    const { deliverWithRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([]);
    await deliverWithRetries(client as never, {
      organizationId: "org-1",
      channel: "email",
      notificationType: "reminder_due",
      recipient: "ops@example.com",
      subject: "Reminder",
      metadata: { blob: "x".repeat(20_000) },
      maxAttempts: 3,
      retryPayload: {
        kind: "reminder_due",
        to: "ops@example.com",
        contractTitle: "A".repeat(1000),
        fieldName: "renewal_date",
        fieldValue: "2026-02-01",
        daysUntil: 2,
        contractUrl: "https://app/contracts/1",
        sourceSnippet: "y".repeat(9000),
      },
      send: async () => ({ error: null }),
    });
    const metadata = rows[0]?.metadata as Record<string, unknown>;
    expect(metadata.metadata_truncated).toBe(true);
    const retryPayload = metadata.retry_payload as Record<string, unknown>;
    expect(String(retryPayload.contractTitle).length).toBeLessThanOrEqual(240);
    expect(String(retryPayload.sourceSnippet).length).toBeLessThanOrEqual(2000);
  });

  it("short-circuits terminal errors without extra retries", async () => {
    const now = new Date().toISOString();
    sendReminderEmailMock.mockResolvedValue({ error: new Error("http_404") });
    const { processNotificationDeliveryRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([
      {
        id: "d1",
        organization_id: "org-1",
        channel: "email",
        notification_type: "reminder_due",
        recipient: "ops@example.com",
        subject: "Reminder",
        status: "pending",
        attempt_count: 0,
        metadata: {
          max_attempts: 5,
          retry_payload: {
            kind: "reminder_due",
            to: "ops@example.com",
            contractTitle: "Test Contract",
            fieldName: "renewal_date",
            fieldValue: "2026-02-01",
            daysUntil: 20,
            contractUrl: "https://app/contracts/1",
          },
        },
        next_attempt_at: now,
        delivered_at: null,
        last_error: null,
        created_at: now,
      },
    ]);

    const summary = await processNotificationDeliveryRetries(client as never, { limit: 10 });
    expect(summary.failed).toBe(1);
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.attempt_count).toBe(1);
    expect(rows[0]?.next_attempt_at).toBeNull();
    expect(rows[0]?.last_error).toContain("[terminal]");
  });

  it("sends slack retry payloads through safeFetch", async () => {
    const now = new Date().toISOString();
    safeFetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { processNotificationDeliveryRetries } = await import("@/lib/notification-delivery");
    const { client, rows } = createFakeAdmin([
      {
        id: "d1",
        organization_id: "org-1",
        channel: "slack",
        notification_type: "automation_rule",
        recipient: null,
        subject: "Slack alert",
        status: "pending",
        attempt_count: 0,
        metadata: {
          max_attempts: 3,
          retry_payload: {
            kind: "slack_workflow",
            webhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
            title: "Slack alert",
            body: "A workflow fired",
            channel: "#ops",
            username: "Oblixa",
            metadata: { trace: "1" },
          },
        },
        next_attempt_at: now,
        delivered_at: null,
        last_error: null,
        created_at: now,
      },
    ]);

    const summary = await processNotificationDeliveryRetries(client as never, { limit: 10 });

    expect(summary.delivered).toBe(1);
    expect(rows[0]?.status).toBe("delivered");
    expect(safeFetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T000/B000/XXX",
      expect.objectContaining({ method: "POST" })
    );
  });
});
