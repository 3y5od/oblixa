import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("integrations slack outbound path", () => {
  it("keeps validated webhook sends on safeFetch", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/integrations/slack.ts"), "utf8");
    expect(raw).toContain('import { safeFetch } from "@/lib/security/safe-fetch"');
    expect(raw).toContain("validateOutboundHttpUrl");
    expect(raw).toContain("hooks.slack.com");
    expect(raw).toContain("safeFetch(webhookUrl.toString()");
    expect(raw).not.toContain("fetch(webhookUrl.toString()");
  });
});