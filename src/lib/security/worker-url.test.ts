import { describe, expect, it } from "vitest";
import { isSafeExtractionWorkerOrigin } from "@/lib/security/worker-url";

describe("isSafeExtractionWorkerOrigin", () => {
  it("allows public https origin", () => {
    expect(isSafeExtractionWorkerOrigin("https://myapp.vercel.app")).toBe(true);
  });

  it("rejects localhost", () => {
    expect(isSafeExtractionWorkerOrigin("http://localhost:3000")).toBe(false);
  });

  it("rejects private IPv4", () => {
    expect(isSafeExtractionWorkerOrigin("https://10.0.0.1")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://192.168.1.1")).toBe(false);
  });

  it("rejects path segments", () => {
    expect(isSafeExtractionWorkerOrigin("https://example.com/internal")).toBe(
      false
    );
  });

  it("rejects credentials in URL", () => {
    expect(
      isSafeExtractionWorkerOrigin("https://user:pass@example.com")
    ).toBe(false);
  });
});
