import { describe, expect, it, vi } from "vitest";
import { fetchJson, readResponseJson, SESSION_OR_AUTH_MESSAGE } from "./client-json";

describe("readResponseJson", () => {
  it("returns data for 200 JSON object", async () => {
    const res = new Response(JSON.stringify({ a: 1 }), { status: 200 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data).toEqual({ a: 1 });
  });

  it("returns ok true with null data for 200 empty body", async () => {
    const res = new Response("", { status: 200 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data).toBeNull();
  });

  it("returns ok true with null data for 204 empty body", async () => {
    const res = new Response(null, { status: 204 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data).toBeNull();
  });

  it("extracts error string from 422 JSON body", async () => {
    const res = new Response(JSON.stringify({ error: "Known message" }), { status: 422 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toBe("Known message");
  });

  it("does not throw on 500 HTML body", async () => {
    const res = new Response("<html><body>error</body></html>", {
      status: 500,
      statusText: "Internal Server Error",
    });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(500);
      expect(out.message.length).toBeGreaterThan(0);
    }
  });

  it("uses session message for 401 without JSON error field", async () => {
    const res = new Response("{}", { status: 401, statusText: "Unauthorized" });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toBe(SESSION_OR_AUTH_MESSAGE);
  });

  it("prefers JSON error over generic 401 when present", async () => {
    const res = new Response(JSON.stringify({ error: "Token expired" }), { status: 401 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toBe("Token expired");
  });

  it("returns invalid response for 200 non-JSON", async () => {
    const res = new Response("not json", { status: 200 });
    const out = await readResponseJson(res);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.message).toBe("Invalid response from server.");
  });
});

describe("fetchJson", () => {
  it("merges same-origin credentials", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    await fetchJson("/api/test");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ credentials: "same-origin" })
    );
    fetchSpy.mockRestore();
  });
});

describe("SESSION_OR_AUTH_MESSAGE", () => {
  it("is stable copy for docs and 403 fallbacks", () => {
    expect(SESSION_OR_AUTH_MESSAGE).toContain("session");
  });
});
