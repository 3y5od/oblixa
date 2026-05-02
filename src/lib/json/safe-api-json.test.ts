import { describe, expect, it } from "vitest";
import { stringifyApiJson } from "./safe-api-json";

describe("stringifyApiJson", () => {
  it("serializes bigint as string", () => {
    expect(stringifyApiJson({ n: BigInt(1) })).toBe('{"n":"1"}');
  });

  it("passes through plain JSON types", () => {
    expect(stringifyApiJson({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });
});
