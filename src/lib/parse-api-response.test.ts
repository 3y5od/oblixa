import { describe, expect, it } from "vitest";
import { readApiJson } from "@/lib/parse-api-response";

function res(body: string, contentType?: string) {
  return new Response(body, {
    headers: contentType ? { "content-type": contentType } : {},
  });
}

describe("readApiJson", () => {
  it("parses JSON object when content-type is application/json", async () => {
    const r = await readApiJson(res('{"a":1}', "application/json"));
    expect(r.isJson).toBe(true);
    expect(r.data).toEqual({ a: 1 });
  });

  it("parses when content-type is application/problem+json", async () => {
    const r = await readApiJson(
      res('{"title":"x"}', "application/problem+json; charset=utf-8")
    );
    expect(r.isJson).toBe(true);
    expect((r.data as { title: string }).title).toBe("x");
  });

  it("detects JSON from leading brace without json content-type", async () => {
    const r = await readApiJson(res('{"x":true}'));
    expect(r.isJson).toBe(true);
  });

  it("treats HTML as non-JSON", async () => {
    const r = await readApiJson(res("<!doctype html><html></html>", "text/html"));
    expect(r.isJson).toBe(false);
    expect(r.data).toEqual({});
    expect(r.rawPreview).toContain("<!doctype");
  });

  it("truncates rawPreview past 400 chars", async () => {
    const long = "x".repeat(500);
    const r = await readApiJson(res(long, "text/plain"));
    expect(r.rawPreview.endsWith("…")).toBe(true);
    expect(r.rawPreview.length).toBeLessThanOrEqual(402);
  });

  it("returns empty preview label for empty body", async () => {
    const r = await readApiJson(res("", "text/plain"));
    expect(r.rawPreview).toContain("empty");
  });

  it("handles invalid JSON that looked like JSON", async () => {
    const r = await readApiJson(res("{not json"));
    expect(r.isJson).toBe(false);
    expect(r.data).toEqual({});
  });
});
