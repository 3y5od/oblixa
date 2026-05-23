import { describe, expect, it } from "vitest";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";

describe("jsonContentTypeRejection", () => {
  it("rejects missing or empty Content-Type", () => {
    expect(jsonContentTypeRejection(new Request("http://localhost", { method: "POST" }))?.details.received).toBe(
      "missing"
    );
    expect(
      jsonContentTypeRejection(new Request("http://localhost", { method: "POST", headers: { "content-type": "  " } }))
        ?.details.received
    ).toBe("missing");
  });

  it("allows parameterized JSON and structured JSON media types", () => {
    expect(
      jsonContentTypeRejection(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      )
    ).toBeNull();
    expect(
      jsonContentTypeRejection(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/vnd.api+json" },
        })
      )
    ).toBeNull();
  });

  it("rejects text/plain defaults and duplicate/ambiguous content types", () => {
    const textPlain = jsonContentTypeRejection(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" },
      })
    );
    expect(textPlain?.status).toBe(415);
    expect(textPlain?.details.received).toContain("text/plain");

    const duplicate = jsonContentTypeRejection(
      new Request("http://localhost", {
        method: "POST",
        headers: new Headers([
          ["content-type", "application/json"],
          ["content-type", "text/plain"],
        ]),
      })
    );
    expect(duplicate?.status).toBe(415);
    expect(duplicate?.details.received).toContain(",");
  });

  it("rejects non-JSON content types when set", () => {
    const r = jsonContentTypeRejection(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----x" },
      })
    );
    expect(r?.status).toBe(415);
    expect(r?.details.expected).toBe("application/json");
    expect(r?.details.received).toContain("multipart/form-data");
  });
});
