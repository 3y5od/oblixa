import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

describe("scrubSentryEvent", () => {
  it("redacts authorization and cookie headers", () => {
    const out = scrubSentryEvent({
      message: "test",
      request: {
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=abc",
          "X-Custom": "ok",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      Authorization: "[redacted]",
      Cookie: "[redacted]",
      "X-Custom": "ok",
    });
  });

  it("passes through when no request", () => {
    const e = { message: "x" };
    expect(scrubSentryEvent(e)).toBe(e);
  });

  it("redacts calibration-shaped extras (no questionnaire payloads in telemetry)", () => {
    const out = scrubSentryEvent({
      message: "wizard",
      request: { headers: {} },
      extra: {
        onboarding_answers: { primary_use_case: "x" },
        calibration_wizard_payload: { step: 1 },
        safe_meta: "ok",
      },
    });
    expect((out as { extra?: Record<string, unknown> }).extra).toEqual({
      onboarding_answers: "[redacted]",
      calibration_wizard_payload: "[redacted]",
      safe_meta: "ok",
    });
  });

  it("redacts webhook and cron-style signature headers", () => {
    const out = scrubSentryEvent({
      request: {
        headers: {
          "stripe-signature": "t=1,v1=abc",
          "x-cron-secret": "sekret",
          "x-vercel-cron-secret": "sekret",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      "stripe-signature": "[redacted]",
      "x-cron-secret": "[redacted]",
      "x-vercel-cron-secret": "[redacted]",
    });
  });

  it("redacts API keys, cookies, and inbound automation tokens (case-insensitive keys)", () => {
    const out = scrubSentryEvent({
      request: {
        headers: {
          "X-Api-Key": "secret",
          "Set-Cookie": "a=b",
          "x-inbound-automation-token": "tok",
          "x-webhook-signature": "sig",
          "x-forwarded-authorization": "Bearer x",
        },
      },
    });
    expect(out.request?.headers).toEqual({
      "X-Api-Key": "[redacted]",
      "Set-Cookie": "[redacted]",
      "x-inbound-automation-token": "[redacted]",
      "x-webhook-signature": "[redacted]",
      "x-forwarded-authorization": "[redacted]",
    });
  });

  it("redacts additional calibration-shaped extra keys", () => {
    const out = scrubSentryEvent({
      request: { headers: {} },
      extra: {
        calibration_answers: { q: 1 },
        onboarding_calibration_json: "{}",
        calibration_questionnaire: [],
      },
    });
    expect((out as { extra?: Record<string, unknown> }).extra).toEqual({
      calibration_answers: "[redacted]",
      onboarding_calibration_json: "[redacted]",
      calibration_questionnaire: "[redacted]",
    });
  });
});
