import { describe, expect, it } from "vitest";
import { parseJsonBodyWithLimit, readJsonBodyLimited } from "@/lib/security/read-json-body-limited";

describe("readJsonBodyLimited", () => {
  it("rejects oversized body by Content-Length", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "9999999", "Content-Type": "application/json" },
      body: "{}",
    });
    const r = await readJsonBodyLimited(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it("parses small JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({ a: 1 });
  });
});

describe("parseJsonBodyWithLimit", () => {
  it("maps body through parse", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: 2 }),
    });
    const r = await parseJsonBodyWithLimit(req, (raw) => String((raw as { x?: number })?.x ?? ""));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBe("2");
  });
});
