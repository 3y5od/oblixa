import { describe, expect, it } from "vitest";
import {
  isContractStoragePathSafe,
  isIsoDateOnly,
  isReasonableEmail,
  isUuid,
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
    it("accepts valid three-segment path with uuid-uuid-filename", () => {
      const tailUuid = "660e8400-e29b-41d4-a716-446655440001";
      const path = `${validUuid}/${validUuid}/${tailUuid}-report.pdf`;
      expect(isContractStoragePathSafe(path)).toBe(true);
    });

    it("rejects null, empty, non-string, length overflow", () => {
      expect(isContractStoragePathSafe(null)).toBe(false);
      expect(isContractStoragePathSafe("")).toBe(false);
      expect(isContractStoragePathSafe("a".repeat(1025))).toBe(false);
    });

    it("rejects traversal, backslash, null byte", () => {
      expect(isContractStoragePathSafe(`${validUuid}/${validUuid}/../x`)).toBe(false);
      expect(isContractStoragePathSafe(`${validUuid}\\${validUuid}/u-f`)).toBe(false);
      expect(isContractStoragePathSafe(`${validUuid}/${validUuid}/\0`)).toBe(false);
    });

    it("rejects wrong segment count or bad tail shape", () => {
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
});
