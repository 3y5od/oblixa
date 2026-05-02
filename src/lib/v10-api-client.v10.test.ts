/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createV10ClientRequestId, createV10IdempotencyKey, getV10BrowserRecoveryState, mutateV10 } from "./v10-api-client";

describe("V10 browser mutation client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates V10-safe client request and idempotency keys", () => {
    expect(createV10IdempotencyKey()).toMatch(/^v10:[A-Za-z0-9:_-]{8,}$/);
    expect(createV10ClientRequestId()).toMatch(/^v10-client:[A-Za-z0-9:_-]{8,}$/);
  });

  it("sends no-store, idempotency, client request, and expected-version headers", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "x-v10-idempotent-replay": "true" }),
      json: async () => ({
        outcome: "success",
        user_visible_message: "Saved.",
        changed_object_type: "work_item",
        changed_object_id: "work-1",
        new_version: "2",
        version_metadata: {
          expected_version: "1",
          current_version: "1",
          new_version: "2",
        },
        next_destination_href: "/work",
        audit_event_id: "audit-1",
        diagnostic_id: null,
        retry_eligible: false,
        replay_state: "replayed",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await mutateV10({
      url: "/api/example",
      body: { ok: true },
      idempotencyKey: "v10:test-key",
      clientRequestId: "v10-client:test-request",
      expectedVersion: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.replayed).toBe(true);
    expect(result.responseClass).toBe("idempotent");
    expect(result.browserRecoveryState).toBe("idempotent_replay");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe(JSON.stringify({ ok: true }));
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).get("Accept")).toBe("application/json");
    expect((init.headers as Headers).get("Cache-Control")).toBe("no-store");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect((init.headers as Headers).get("x-idempotency-key")).toBe("v10:test-key");
    expect((init.headers as Headers).get("x-client-request-id")).toBe("v10-client:test-request");
    expect((init.headers as Headers).get("x-v10-expected-version")).toBe("1");
  });

  it("maps non-envelope HTTP failures to recoverable user copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => ({ error: "Too many requests" }),
      }))
    );

    const result = await mutateV10({ url: "/api/example" });

    expect(result.ok).toBe(false);
    expect(result.response.outcome).toBe("rate_limited");
    expect(result.retryAppropriate).toBe(true);
    expect(result.userMessage).toMatch(/temporarily rate limited/i);
  });

  it("returns a retryable server-error envelope on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const result = await mutateV10({ url: "/api/example" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.response.outcome).toBe("server_error");
    expect(result.response.diagnostic_id).toBe("v10_browser_network_error");
    expect(result.retryAppropriate).toBe(true);
    expect(result.browserRecoveryState).toBe("offline_retry");
  });

  it("classifies browser recovery states for stale, validation, payload conflict, and abort paths", async () => {
    expect(getV10BrowserRecoveryState({ responseClass: "stale" })).toBe("stale_refresh_required");
    expect(getV10BrowserRecoveryState({ responseClass: "validation", validationFailureCount: 1 })).toBe("validation_self_fix");
    expect(getV10BrowserRecoveryState({ responseClass: "retryable", replayState: "payload_conflict" })).toBe("payload_conflict");
    expect(getV10BrowserRecoveryState({ responseClass: "terminal" })).toBe("terminal_support");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      })
    );

    const result = await mutateV10({ url: "/api/example" });

    expect(result.retryAppropriate).toBe(false);
    expect(result.response.diagnostic_id).toBe("v10_browser_request_aborted");
    expect(result.browserRecoveryState).toBe("aborted_no_retry");
  });
});
