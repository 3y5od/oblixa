import { describe, expect, it } from "vitest";
import { readResponseJson } from "@/lib/http/client-json";

/** Tier 43 — no raw `Error.stack` in `readResponseJson` user messages. */
describe("unified user-visible error shape (readResponseJson)", () => {
  it("500 JSON with error field maps to API error string, not [object Object]", async () => {
    const res = new Response(JSON.stringify({ error: "Nope" }), { status: 500, statusText: "Server Error" });
    const r = await readResponseJson(res);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe("Nope");
      expect(r.message).not.toMatch(/at\s+\w+Module/);
    }
  });
});
