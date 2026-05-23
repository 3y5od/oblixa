import { describe, expect, it } from "vitest";
import { requireTenantAiProcessingEnabled } from "@/lib/security/ai-tenant-gate";

function adminWithSettings(settings: Record<string, unknown>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { v6_org_settings_json: settings }, error: null }),
        }),
      }),
    }),
  };
}

describe("requireTenantAiProcessingEnabled", () => {
  it("requires explicit tenant opt-in for production AI/OCR processing", async () => {
    await expect(
      requireTenantAiProcessingEnabled(adminWithSettings({}) as never, "org-1", {
        NODE_ENV: "production",
      })
    ).resolves.toEqual({ ok: false, reason: "tenant_ai_processing_disabled" });

    await expect(
      requireTenantAiProcessingEnabled(
        adminWithSettings({ ai_processing_enabled: true }) as never,
        "org-1",
        { NODE_ENV: "production" }
      )
    ).resolves.toEqual({ ok: true });
  });

  it("allows local/test defaults but honors explicit tenant disablement", async () => {
    await expect(
      requireTenantAiProcessingEnabled(adminWithSettings({}) as never, "org-1", {
        NODE_ENV: "test",
      })
    ).resolves.toEqual({ ok: true });

    await expect(
      requireTenantAiProcessingEnabled(
        adminWithSettings({ ai_processing_enabled: false }) as never,
        "org-1",
        { NODE_ENV: "test" }
      )
    ).resolves.toEqual({ ok: false, reason: "tenant_ai_processing_disabled" });
  });
});
