import { describe, it, expect } from "vitest";
import mammoth from "mammoth";

describe("document parser boundaries", () => {
  it("mammoth rejects non-docx buffer", async () => {
    await expect(mammoth.extractRawText({ buffer: Buffer.from("not-a-zip-archive") })).rejects.toThrow();
  });
});
