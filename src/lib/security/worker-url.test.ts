import { afterEach, describe, expect, it, vi } from "vitest";
import { isSafeExtractionWorkerOrigin } from "@/lib/security/worker-url";

describe("isSafeExtractionWorkerOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows public https origin", () => {
    expect(isSafeExtractionWorkerOrigin("https://myapp.vercel.app")).toBe(true);
  });

  it("allows scheme-less host in non-production (https implied)", () => {
    expect(isSafeExtractionWorkerOrigin("myapp.vercel.app")).toBe(true);
  });

  it("rejects empty and invalid URLs", () => {
    expect(isSafeExtractionWorkerOrigin("")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("   ")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://")).toBe(false);
  });

  it("rejects localhost", () => {
    expect(isSafeExtractionWorkerOrigin("http://localhost:3000")).toBe(false);
  });

  it("rejects metadata and link-local style hosts", () => {
    expect(isSafeExtractionWorkerOrigin("http://metadata")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://metadata.google.internal")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://169.254.169.254")).toBe(false);
  });

  it("rejects private IPv4", () => {
    expect(isSafeExtractionWorkerOrigin("https://10.0.0.1")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://192.168.1.1")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://172.20.0.1")).toBe(false);
  });

  it("rejects private IPv6 literals", () => {
    expect(isSafeExtractionWorkerOrigin("http://[::1]")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("http://[fe80::1]")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("http://[fd00::1]")).toBe(false);
  });

  it("rejects path segments", () => {
    expect(isSafeExtractionWorkerOrigin("https://example.com/internal")).toBe(
      false
    );
  });

  it("rejects query and hash", () => {
    expect(isSafeExtractionWorkerOrigin("https://example.com/?q=1")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://example.com/#frag")).toBe(false);
  });

  it("rejects credentials in URL", () => {
    expect(
      isSafeExtractionWorkerOrigin("https://user:pass@example.com")
    ).toBe(false);
  });

  it("rejects http in production-like env", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(isSafeExtractionWorkerOrigin("http://example.com")).toBe(false);
    expect(isSafeExtractionWorkerOrigin("https://example.com")).toBe(true);
  });
});
