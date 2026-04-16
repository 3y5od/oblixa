import { describe, expect, it } from "vitest";
import {
  allV8ExemptSurfaceRules,
  resolveActionExemptSurface,
  resolveApiExemptSurface,
  resolvePageExemptSurface,
  type V8ExemptSurfaceClass,
} from "@/lib/product-surface/v8-exempt-surfaces";

const ALL_EXEMPT_CLASSES: V8ExemptSurfaceClass[] = [
  "auth_entry",
  "legal_marketing",
  "static_information",
  "webhook",
  "cron",
  "tracking",
  "tokenized_capability",
  "health_instrumentation",
  "infra_utility",
];

describe("v8 exempt surface exemplars (inventory §29)", () => {
  it("each exempt class resolves from at least one page, api, or action rule", () => {
    const rules = allV8ExemptSurfaceRules();
    const covered = new Set<V8ExemptSurfaceClass>();

    for (const r of rules.page) {
      covered.add(r.class);
      const path = r.pathPrefix === "/" ? "/" : r.pathPrefix;
      const hit = resolvePageExemptSurface(path);
      expect(hit, `page rule ${r.pathPrefix}`).not.toBeNull();
      expect(hit!.class).toBe(r.class);
    }

    for (const r of rules.api) {
      covered.add(r.class);
      const probe = `${r.pathPrefix}probe`;
      const hit = resolveApiExemptSurface(probe);
      expect(hit, `api rule ${r.pathPrefix}`).not.toBeNull();
      expect(hit!.class).toBe(r.class);
    }

    for (const r of rules.action) {
      covered.add(r.class);
      const hit = resolveActionExemptSurface(r.filePrefix);
      expect(hit, `action rule ${r.filePrefix}`).not.toBeNull();
      expect(hit!.class).toBe(r.class);
    }

    for (const c of ALL_EXEMPT_CLASSES) {
      expect(covered.has(c), `No exemplar registered for class ${c}`).toBe(true);
    }
  });

  it("keeps concrete webhook/payment/cron/token exemplars stable (§17.1)", () => {
    expect(resolveApiExemptSurface("/api/stripe/webhook")?.class).toBe("webhook");
    expect(resolveApiExemptSurface("/api/cron/healthcheck")?.class).toBe("cron");
    expect(resolveApiExemptSurface("/api/export/calendar/feed/token-abc")?.class).toBe(
      "tokenized_capability"
    );
    expect(resolveApiExemptSurface("/api/tracking/open")?.class).toBe("tracking");
  });
});
