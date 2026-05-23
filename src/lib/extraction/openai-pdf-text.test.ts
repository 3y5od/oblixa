import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteOpenAiUploadedFile } from "@/lib/extraction/openai-pdf-text";

describe("openai-pdf-text cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms uploaded OCR files are deleted", async () => {
    const client = { files: { delete: vi.fn(async () => ({ id: "file_1", deleted: true })) } };

    await expect(deleteOpenAiUploadedFile(client as never, "file_1")).resolves.toBe(true);
    expect(client.files.delete).toHaveBeenCalledWith("file_1");
  });

  it("audits cleanup failures without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = { files: { delete: vi.fn(async () => ({ id: "file_1", deleted: false })) } };

    await expect(deleteOpenAiUploadedFile(client as never, "file_1")).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith("[openai-pdf-text] upload deletion was not confirmed");
  });
});
