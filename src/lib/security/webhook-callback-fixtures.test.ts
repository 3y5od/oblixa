import { describe, expect, it } from "vitest";
import { WEBHOOK_CALLBACK_FIXTURES } from "./webhook-callback-fixtures";

describe("webhook and callback fixture corpus", () => {
  it("covers required webhook fixture branches without duplicate ids", () => {
    const ids = new Set(WEBHOOK_CALLBACK_FIXTURES.map((fixture) => fixture.id));
    expect(ids.size).toBe(WEBHOOK_CALLBACK_FIXTURES.length);

    const stripeKinds = new Set(
      WEBHOOK_CALLBACK_FIXTURES.filter((fixture) => fixture.family === "stripe_webhook").map(
        (fixture) => fixture.kind
      )
    );
    expect(stripeKinds).toEqual(
      new Set([
        "success",
        "duplicate_delivery",
        "bad_signature",
        "stale_timestamp",
        "unknown_event",
        "malformed_payload",
        "wrong_content_type",
        "provider_outage",
      ])
    );
  });

  it("records replay-safety and destination-abuse fixtures for callbacks", () => {
    expect(WEBHOOK_CALLBACK_FIXTURES.every((fixture) => fixture.replaySafe)).toBe(true);
    expect(
      WEBHOOK_CALLBACK_FIXTURES.some(
        (fixture) => fixture.family === "oauth_callback" && fixture.kind === "open_redirect"
      )
    ).toBe(true);
    expect(
      WEBHOOK_CALLBACK_FIXTURES.some(
        (fixture) => fixture.family === "oauth_callback" && fixture.kind === "private_network_url"
      )
    ).toBe(true);
    expect(
      WEBHOOK_CALLBACK_FIXTURES.some(
        (fixture) => fixture.family === "auth_callback" && fixture.kind === "custom_scheme"
      )
    ).toBe(true);
  });
});
