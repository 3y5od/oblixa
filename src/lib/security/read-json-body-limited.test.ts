import { describe, expect, it } from "vitest";
import {
  parseJsonBodyWithLimit,
  readJsonBodyLimited,
  readTextBodyLimited,
  rejectUnexpectedBody,
} from "@/lib/security/read-json-body-limited";

describe("readJsonBodyLimited", () => {
  it("rejects oversized body by Content-Length", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "9999999", "Content-Type": "application/json" },
      body: "{}",
    });
    const r = await readJsonBodyLimited(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(413);
      await expect(r.response.json()).resolves.toMatchObject({
        code: "payload_too_large",
        diagnostic_id: "route_payload_too_large",
      });
    }
  });

  it("rejects oversized body after reading when Content-Length is absent", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(120) }),
    });
    const r = await readJsonBodyLimited(req, 20);
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

  it("rejects non-JSON Content-Type before parsing", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: JSON.stringify({ a: 1 }),
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(415);
      await expect(r.response.json()).resolves.toMatchObject({
        code: "unsupported_media_type",
        diagnostic_id: "route_unsupported_media_type",
      });
    }
  });

  it("rejects missing, wrong, duplicate, and text/plain JSON content types", async () => {
    for (const req of [
      new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) }),
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ a: 1 }),
      }),
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: JSON.stringify({ a: 1 }),
      }),
      new Request("http://x", {
        method: "POST",
        headers: new Headers([
          ["Content-Type", "application/json"],
          ["Content-Type", "text/plain"],
        ]),
        body: JSON.stringify({ a: 1 }),
      }),
    ]) {
      const r = await readJsonBodyLimited(req);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(415);
    }
  });

  it("allows parameterized JSON content types", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ a: 1 }),
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(true);
  });

  it("returns safe 400 for invalid JSON", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      await expect(r.response.json()).resolves.toMatchObject({
        code: "invalid_request",
        diagnostic_id: "route_invalid_request",
        details: { reason: "invalid_json" },
      });
    }
  });

  it("rejects prototype-pollution keys after parsing", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"safe":{"__proto__":{"polluted":true}}}',
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      await expect(r.response.json()).resolves.toMatchObject({
        code: "invalid_request",
        diagnostic_id: "route_invalid_request",
        details: { reason: "unsafe_json_key" },
      });
    }
  });

  it("rejects JSON shapes that exceed structural limits", async () => {
    const tooManyKeys = Object.fromEntries(Array.from({ length: 1_001 }, (_, index) => [`k${index}`, index]));
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tooManyKeys),
    });
    const r = await readJsonBodyLimited(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      await expect(r.response.json()).resolves.toMatchObject({
        details: { reason: "json_shape_too_large" },
      });
    }
  });
});

describe("readTextBodyLimited", () => {
  it("rejects oversized text body before parsing", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "101", "Content-Type": "text/plain" },
      body: "small",
    });
    const r = await readTextBodyLimited(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it("reads small text bodies", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    const r = await readTextBodyLimited(req, 100);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toBe("hello");
  });

  it("rejects oversized multibyte bodies by byte count", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "é",
    });
    const r = await readTextBodyLimited(req, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it("rejects malformed content-length", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "1, 1", "Content-Type": "text/plain" },
      body: "x",
    });
    const r = await readTextBodyLimited(req, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
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

describe("rejectUnexpectedBody", () => {
  it("allows requests with no body", async () => {
    const req = new Request("http://x", { method: "POST" });
    await expect(rejectUnexpectedBody(req)).resolves.toBeNull();
  });

  it("allows explicit zero content length", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "0" },
    });
    await expect(rejectUnexpectedBody(req)).resolves.toBeNull();
  });

  it("rejects positive content length without reading", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "2" },
      body: "{}",
    });
    const res = await rejectUnexpectedBody(req);
    expect(res?.status).toBe(400);
  });

  it("rejects malformed content length", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "Content-Length": "1, 1" },
      body: "x",
    });
    const res = await rejectUnexpectedBody(req);
    expect(res?.status).toBe(400);
  });

  it("rejects streamed bodies when content length is absent", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: "x",
    });
    const res = await rejectUnexpectedBody(req);
    expect(res?.status).toBe(400);
  });
});
