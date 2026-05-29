import { describe, expect, it } from "vitest";
import {
  buildContractStoragePath,
  containsControlOrBidi,
  hasUnsafeJsonKey,
  isContractStoragePathSafe,
  isIsoDateOnly,
  isJsonShapeWithinLimits,
  isReasonableEmail,
  isSafeRouteParam,
  isUuid,
  parseBooleanParam,
  parseContractStoragePath,
  parseFixedEnumParam,
  parseFixedSortKey,
  parseFutureIsoTimestamp,
  parseIsoDateRange,
  parseIsoTimestampParam,
  parsePositiveIntParam,
  validateBoundedString,
} from "@/lib/security/validation";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("validation", () => {
  describe("isUuid", () => {
    it("returns false for null, undefined, non-string", () => {
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);
      expect(isUuid(1 as unknown as string)).toBe(false);
    });

    it("trims whitespace", () => {
      expect(isUuid(`  ${validUuid}  `)).toBe(true);
    });

    it("accepts uppercase hex", () => {
      expect(isUuid(validUuid.toUpperCase())).toBe(true);
    });

    it("rejects wrong length, bad chars, wrong version char positions", () => {
      expect(isUuid("")).toBe(false);
      expect(isUuid("not-a-uuid")).toBe(false);
      expect(isUuid(`${validUuid.slice(0, -1)}x`)).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
    });
  });

  describe("isContractStoragePathSafe", () => {
    it("accepts namespaced contract storage paths with uuid-uuid-filename", () => {
      const tailUuid = "660e8400-e29b-41d4-a716-446655440001";
      const path = `org/${validUuid}/${validUuid}/${tailUuid}-report.pdf`;
      expect(isContractStoragePathSafe(path)).toBe(true);
      expect(parseContractStoragePath(path)).toMatchObject({
        organizationId: validUuid,
        contractId: validUuid,
        objectId: tailUuid,
        fileName: "report.pdf",
        legacyShape: false,
      });
    });

    it("keeps legacy three-segment storage paths readable", () => {
      const tailUuid = "660e8400-e29b-41d4-a716-446655440001";
      const path = `${validUuid}/${validUuid}/${tailUuid}-legacy.pdf`;
      expect(isContractStoragePathSafe(path)).toBe(true);
      expect(parseContractStoragePath(path)).toMatchObject({
        organizationId: validUuid,
        contractId: validUuid,
        legacyShape: true,
      });
    });

    it("builds namespaced org-scoped storage paths", () => {
      const tailUuid = "660e8400-e29b-41d4-a716-446655440001";
      expect(buildContractStoragePath(validUuid, validUuid, "report.pdf", tailUuid)).toBe(
        `org/${validUuid}/${validUuid}/${tailUuid}-report.pdf`
      );
    });

    it("rejects null, empty, non-string, length overflow", () => {
      expect(isContractStoragePathSafe(null)).toBe(false);
      expect(isContractStoragePathSafe("")).toBe(false);
      expect(isContractStoragePathSafe("a".repeat(1025))).toBe(false);
    });

    it("rejects traversal, backslash, null byte", () => {
      expect(isContractStoragePathSafe(`org/${validUuid}/${validUuid}/../x`)).toBe(false);
      expect(isContractStoragePathSafe(`org/${validUuid}\\${validUuid}/u-f`)).toBe(false);
      expect(isContractStoragePathSafe(`org/${validUuid}/${validUuid}/\0`)).toBe(false);
    });

    it("rejects wrong segment count or bad tail shape", () => {
      expect(isContractStoragePathSafe(`other/${validUuid}/${validUuid}/660e8400-e29b-41d4-a716-446655440001-x.pdf`)).toBe(false);
      expect(isContractStoragePathSafe(`${validUuid}/${validUuid}`)).toBe(false);
      expect(isContractStoragePathSafe(`${validUuid}/${validUuid}/nope`)).toBe(false);
      expect(isContractStoragePathSafe(`${validUuid}/${validUuid}/660e8400-e29b-41d4-a716-446655440001-`)).toBe(
        false
      );
    });
  });

  describe("isReasonableEmail", () => {
    it("accepts typical emails within length", () => {
      expect(isReasonableEmail("a@b.co")).toBe(true);
      expect(isReasonableEmail("  user+tag@example.com  ")).toBe(true);
    });

    it("rejects over 254 chars", () => {
      const local = "a".repeat(250);
      expect(isReasonableEmail(`${local}@x.co`)).toBe(false);
    });

    it("rejects invalid forms", () => {
      expect(isReasonableEmail("")).toBe(false);
      expect(isReasonableEmail("no-at")).toBe(false);
      expect(isReasonableEmail("@nodomain")).toBe(false);
    });
  });

  describe("isIsoDateOnly", () => {
    it("returns false for non-string", () => {
      expect(isIsoDateOnly(null)).toBe(false);
      expect(isIsoDateOnly(undefined)).toBe(false);
    });

    it("accepts valid calendar dates in UTC normalization", () => {
      expect(isIsoDateOnly("2024-01-15")).toBe(true);
      expect(isIsoDateOnly("  2024-01-15  ")).toBe(true);
    });

    it("rejects invalid calendar dates and wrong format", () => {
      expect(isIsoDateOnly("2025-02-30")).toBe(false);
      expect(isIsoDateOnly("24-01-15")).toBe(false);
      expect(isIsoDateOnly("2024-1-05")).toBe(false);
    });
  });

  describe("JSON shape safety", () => {
    it("detects prototype-pollution keys at any depth", () => {
      expect(hasUnsafeJsonKey(JSON.parse('{"__proto__":{"polluted":true}}'))).toBe(true);
      expect(hasUnsafeJsonKey({ nested: { constructor: "x" } })).toBe(true);
      expect(hasUnsafeJsonKey({ nested: [{ prototype: "x" }] })).toBe(true);
      expect(hasUnsafeJsonKey({ safe: { value: true } })).toBe(false);
    });

    it("rejects excessive depth, arrays, object keys, and string lengths", () => {
      expect(isJsonShapeWithinLimits({ a: { b: { c: true } } }, { maxDepth: 4 })).toBe(true);
      expect(isJsonShapeWithinLimits({ a: { b: { c: true } } }, { maxDepth: 1 })).toBe(false);
      expect(isJsonShapeWithinLimits([1, 2, 3], { maxArrayLength: 2 })).toBe(false);
      expect(isJsonShapeWithinLimits({ a: 1, b: 2 }, { maxKeys: 1 })).toBe(false);
      expect(isJsonShapeWithinLimits({ a: "x".repeat(6) }, { maxStringLength: 5 })).toBe(false);
    });

    it("can allow JSON whitespace controls while still rejecting unsafe controls", () => {
      expect(isJsonShapeWithinLimits({ note: "line 1\nline 2\tok" }, { allowJsonWhitespaceControls: true })).toBe(true);
      expect(isJsonShapeWithinLimits({ note: "bad\u0001value" }, { allowJsonWhitespaceControls: true })).toBe(false);
      expect(isJsonShapeWithinLimits({ note: "bad\u202Evalue" }, { allowJsonWhitespaceControls: true })).toBe(false);
    });
  });

  describe("text safety", () => {
    it("rejects bidi and control characters", () => {
      expect(containsControlOrBidi("safe")).toBe(false);
      expect(containsControlOrBidi("safe\u202Etxt")).toBe(true);
      expect(containsControlOrBidi("safe\u0001txt")).toBe(true);
    });

    it("validates bounded strings", () => {
      expect(validateBoundedString("  name  ", { maxLength: 10 })).toEqual({ ok: true, value: "name" });
      expect(validateBoundedString("", { maxLength: 10 }).ok).toBe(false);
      expect(validateBoundedString("x".repeat(11), { maxLength: 10 })).toEqual({
        ok: false,
        error: "string_too_long",
      });
      expect(validateBoundedString("bad\u202Ename", { maxLength: 20 })).toEqual({
        ok: false,
        error: "unsafe_characters",
      });
    });

    it("validates bounded multiline text while rejecting unsafe controls", () => {
      expect(validateBoundedString(" line 1\nline 2\tok ", { maxLength: 40, allowTextWhitespaceControls: true })).toEqual({
        ok: true,
        value: "line 1\nline 2\tok",
      });
      expect(validateBoundedString("bad\u0001name", { maxLength: 20, allowTextWhitespaceControls: true })).toEqual({
        ok: false,
        error: "unsafe_characters",
      });
      expect(validateBoundedString("bad\u202Ename", { maxLength: 20, allowTextWhitespaceControls: true })).toEqual({
        ok: false,
        error: "unsafe_characters",
      });
    });
  });

  describe("route parameter safety", () => {
    it("accepts bounded route-safe identifiers and tokens", () => {
      expect(isSafeRouteParam("c1")).toBe(true);
      expect(isSafeRouteParam("job-1")).toBe(true);
      expect(isSafeRouteParam("token_abc.123:state")).toBe(true);
    });

    it("rejects empty, trimmed, encoded, separator, control, bidi, and overlong params", () => {
      expect(isSafeRouteParam("")).toBe(false);
      expect(isSafeRouteParam(" c1")).toBe(false);
      expect(isSafeRouteParam("..")).toBe(false);
      expect(isSafeRouteParam("a/b")).toBe(false);
      expect(isSafeRouteParam("a%2fb")).toBe(false);
      expect(isSafeRouteParam("a\\b")).toBe(false);
      expect(isSafeRouteParam("a\r\nX-Bad: yes")).toBe(false);
      expect(isSafeRouteParam("safe\u202Etxt")).toBe(false);
      expect(isSafeRouteParam("x".repeat(513))).toBe(false);
    });
  });

  describe("query parsing helpers", () => {
    it("caps pagination limits and falls back on invalid numbers", () => {
      expect(parsePositiveIntParam("5", { defaultValue: 10, max: 50 })).toBe(5);
      expect(parsePositiveIntParam("500", { defaultValue: 10, max: 50 })).toBe(50);
      expect(parsePositiveIntParam("nope", { defaultValue: 10, max: 50 })).toBe(10);
    });

    it("selects only fixed sort keys", () => {
      expect(parseFixedSortKey("created_at", ["created_at", "name"], "name")).toBe("created_at");
      expect(parseFixedSortKey("raw_sql", ["created_at", "name"], "name")).toBe("name");
    });

    it("selects only fixed enum values", () => {
      expect(parseFixedEnumParam("csv", ["json", "csv"], "json")).toBe("csv");
      expect(parseFixedEnumParam("text/html", ["json", "csv"], "json")).toBe("json");
    });

    it("parses only explicit boolean query flags", () => {
      expect(parseBooleanParam(null, { defaultValue: true })).toEqual({ ok: true, value: true });
      expect(parseBooleanParam("0", { defaultValue: true })).toEqual({ ok: true, value: false });
      expect(parseBooleanParam("false", { defaultValue: true })).toEqual({ ok: true, value: false });
      expect(parseBooleanParam("1", { defaultValue: false })).toEqual({ ok: true, value: true });
      expect(parseBooleanParam("true", { defaultValue: false })).toEqual({ ok: true, value: true });
      expect(parseBooleanParam("yes", { defaultValue: false })).toEqual({ ok: false, error: "invalid_boolean" });
    });

    it("validates date ranges and maximum span", () => {
      expect(parseIsoDateRange({ from: "2024-01-01", to: "2024-01-31" }, { maxDays: 31 }).ok).toBe(true);
      expect(parseIsoDateRange({ from: "2024-02-01", to: "2024-01-01" }, { maxDays: 31 })).toEqual({
        ok: false,
        error: "date_range_inverted",
      });
      expect(parseIsoDateRange({ from: "2024-01-01", to: "2024-02-15" }, { maxDays: 31 })).toEqual({
        ok: false,
        error: "date_range_too_large",
      });
    });

    it("validates bounded ISO timestamp query parameters", () => {
      const now = Date.parse("2026-05-10T00:00:00.000Z");
      expect(parseIsoTimestampParam("2026-05-01T12:30:00.000Z", { now, maxLookbackDays: 30 })).toEqual({
        ok: true,
        value: "2026-05-01T12:30:00.000Z",
        date: new Date("2026-05-01T12:30:00.000Z"),
      });
      expect(parseIsoTimestampParam("2026-05-01", { now, maxLookbackDays: 30 })).toEqual({
        ok: false,
        error: "invalid_timestamp",
      });
      expect(parseIsoTimestampParam("2026-03-01T00:00:00.000Z", { now, maxLookbackDays: 30 })).toEqual({
        ok: false,
        error: "timestamp_too_old",
      });
      expect(parseIsoTimestampParam("2026-05-10T00:10:01.000Z", { now, maxLookbackDays: 30, maxFutureSkewMinutes: 10 })).toEqual({
        ok: false,
        error: "timestamp_in_future",
      });
    });

    it("validates future ISO timestamp deadlines", () => {
      const now = Date.parse("2026-05-10T00:00:00.000Z");
      expect(parseFutureIsoTimestamp("2026-05-11T12:30:00Z", { now, maxFutureDays: 30 })).toEqual({
        ok: true,
        value: "2026-05-11T12:30:00.000Z",
        date: new Date("2026-05-11T12:30:00.000Z"),
      });
      expect(parseFutureIsoTimestamp("2026-05-11", { now, maxFutureDays: 30 })).toEqual({
        ok: false,
        error: "invalid_timestamp",
      });
      expect(parseFutureIsoTimestamp("2026-05-10T00:00:00.000Z", { now, maxFutureDays: 30 })).toEqual({
        ok: false,
        error: "timestamp_not_future",
      });
      expect(parseFutureIsoTimestamp("2026-06-15T00:00:00.000Z", { now, maxFutureDays: 30 })).toEqual({
        ok: false,
        error: "timestamp_too_far_in_future",
      });
    });
  });
});
