/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

describe("DOCX / PDF parse boundaries (corrupt input)", () => {
  it("mammoth rejects truncated docx buffer with a controlled error", async () => {
    const mammoth = await import("mammoth");
    const buf = Buffer.from("PK\x03\x04not-a-real-docx", "utf8");
    await expect(mammoth.extractRawText({ buffer: buf })).rejects.toThrow();
  });
});
