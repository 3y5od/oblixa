import { describe, expect, it, vi } from "vitest";
import {
  clampProductTelemetryDetails,
  emitProductTelemetryEvent,
  emitV10ObjectiveTelemetryEvent,
  PRODUCT_TELEMETRY_ACTIONS,
  sanitizeV10TelemetryUrl,
  V10_TELEMETRY_COMPATIBILITY_BRIDGES,
  V10_TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS,
} from "./product-telemetry";

describe("V10 product telemetry", () => {
  it("allowlists objective metric events without private payloads", async () => {
    const v10Actions = PRODUCT_TELEMETRY_ACTIONS.filter((action) => action.startsWith("product.v10."));
    expect(v10Actions).toEqual(
      expect.arrayContaining([
        "product.v10.activation_completed",
        "product.v10.first_work_item_generated",
        "product.v10.review_queue_cleared",
        "product.v10.evidence_request_created",
        "product.v10.evidence_submitted",
        "product.v10.evidence_review_decision_recorded",
        "product.v10.approval_decision_recorded",
        "product.v10.approval_sla_breached",
        "product.v10.exception_resolution_recorded",
        "product.v10.renewal_checkpoint_completed",
        "product.v10.renewal_checkpoint_reopened",
        "product.v10.renewal_decision_packet_generated",
        "product.v10.import_extraction_failure_rate_sampled",
        "product.v10.contract_record_opened",
        "product.v10.command_palette_opened",
        "product.v10.command_palette_recovered",
        "product.v10.command_palette_result_selected",
        "product.v10.command_palette_zero_result",
        "product.v10.empty_state_cta_clicked",
        "product.v10.contract_record_trust_viewed",
        "product.v10.field_review_completed",
        "product.v10.review_save_next_used",
      ])
    );
    expect(v10Actions.every((action) => /^product\.v10\.[a-z0-9_]+$/.test(action))).toBe(true);
    expect(
      Object.keys(V10_TELEMETRY_EVENT_EVIDENCE_EXCEPTIONS).every((action) =>
        v10Actions.includes(action as (typeof PRODUCT_TELEMETRY_ACTIONS)[number])
      )
    ).toBe(true);

    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ insert })) };
    await emitProductTelemetryEvent(admin as never, {
      organizationId: "org_1",
      userId: "user_1",
      contractId: "contract_1",
      action: "product.v10.approval_sla_breached",
      details: { metric: "approval_sla", status: "breached", count: 2 },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_1",
        action: "product.v10.approval_sla_breached",
        details: { metric: "approval_sla", status: "breached", count: 2 },
      })
    );
  });

  it("redacts email-like private strings before writing telemetry details", () => {
    expect(clampProductTelemetryDetails({ responder: "contract.owner@example.com" })).toEqual({
      responder: "[redacted]",
    });
    expect(
      clampProductTelemetryDetails({
        status: "failed",
        raw_contract_text: "private clause",
        signed_url: "https://storage.example/file.pdf?token=secret",
      })
    ).toEqual({
      status: "failed",
      dropped_field_count: 2,
    });
    expect(sanitizeV10TelemetryUrl("https://app.oblixa.test/contracts/contract_1?token=secret&tab=audit")).toBe(
      "/contracts/contract_1?tab=audit"
    );
    expect(clampProductTelemetryDetails({ href: "/work?lens=failed_jobs&signature=private&mode=core" })).toEqual({
      href: "/work?lens=failed_jobs&mode=core",
    });
  });

  it("emits objective telemetry with only objective-allowlisted fields", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = { from: vi.fn(() => ({ insert })) };
    await emitV10ObjectiveTelemetryEvent(admin as never, {
      organizationId: "org_1",
      userId: "user_1",
      objectiveKey: "search_as_router",
      action: "product.v10.command_palette_zero_result",
      details: {
        query_class: "navigation",
        result_count: 0,
        zero_result: true,
        responder_email: "person@example.com",
      },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.v10.command_palette_zero_result",
        details: {
          query_class: "navigation",
          result_count: 0,
          zero_result: true,
          dropped_field_count: 1,
        },
      })
    );
  });

  it("bridges protected v9 telemetry to authoritative v10 measurement names", () => {
    const actions = new Set(PRODUCT_TELEMETRY_ACTIONS);
    expect(V10_TELEMETRY_COMPATIBILITY_BRIDGES).toMatchObject({
      "product.v9.evidence_requested": "product.v10.evidence_request_created",
      "product.v9.evidence_submitted": "product.v10.evidence_submitted",
      "product.v9.cmdk_palette_opened": "product.v10.command_palette_opened",
      "product.v9.cmdk_zero_results": "product.v10.command_palette_zero_result",
      "product.v9.review_save_next_used": "product.v10.review_save_next_used",
    });
    for (const [legacyAction, v10Action] of Object.entries(V10_TELEMETRY_COMPATIBILITY_BRIDGES)) {
      expect(actions.has(legacyAction as (typeof PRODUCT_TELEMETRY_ACTIONS)[number]), legacyAction).toBe(true);
      expect(actions.has(v10Action as (typeof PRODUCT_TELEMETRY_ACTIONS)[number]), v10Action).toBe(true);
      expect(v10Action.startsWith("product.v10."), v10Action).toBe(true);
    }
  });
});
