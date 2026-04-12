import { describe, expect, it } from "vitest";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";

describe("jsonContentTypeRejection", () => {
  it("allows missing or empty Content-Type", () => {
    expect(jsonContentTypeRejection(new Request("http://localhost", { method: "POST" }))).toBeNull();
    expect(
      jsonContentTypeRejection(
        new Request("http://localhost", { method: "POST", headers: { "content-type": "  " } })
      )
    ).toBeNull();
  });

  it("allows application/json variants", () => {
    expect(
      jsonContentTypeRejection(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      )
    ).toBeNull();
  });

  it("allows text/plain (common default for string bodies)", () => {
    expect(
      jsonContentTypeRejection(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "text/plain;charset=UTF-8" },
        })
      )
    ).toBeNull();
  });

  it("rejects non-JSON content types when set", () => {
    const r = jsonContentTypeRejection(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
      })
    );
    expect(r?.status).toBe(415);
    expect(r?.body.error).toMatch(/application\/json/i);
  });
});
