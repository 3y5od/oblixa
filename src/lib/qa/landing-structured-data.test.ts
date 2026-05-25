import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalPageJsonLd } from "@/components/landing/legal-page-json-ld";
import { serializeJsonLdForInlineScript } from "@/lib/security/json-ld-inline-script";

describe("Marketing JSON-LD (parseable, Tier 60 plan)", () => {
  it("emits valid JSON for WebPage in LegalPageJsonLd", () => {
    const html = renderToStaticMarkup(
      createElement(LegalPageJsonLd, { path: "/terms", title: "Terms", description: "T" })
    );
    const m = html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(m, "json-ld script body").toBeTruthy();
    if (!m) return;
    const parsed = JSON.parse(m[1]) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    const first = parsed[0] as { "@type"?: string };
    expect(first["@type"]).toBe("WebPage");
  });

  it("serializes to script-safe string", () => {
    const obj = { "@context": "https://schema.org", "@type": "Thing", name: "x" };
    const s = serializeJsonLdForInlineScript(obj);
    expect(s).not.toMatch(/</);
    expect(JSON.parse(s).name).toBe("x");
  });
});
