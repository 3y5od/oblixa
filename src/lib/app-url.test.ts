import { describe, it, expect, afterEach } from "vitest";
import {
  getAppBaseUrlFromEnv,
  getRequestOrigin,
  resolveExtractionWorkerOrigin,
} from "@/lib/app-url";

describe("getRequestOrigin", () => {
  it("returns origin from Request URL", () => {
    const r = new Request("https://my-preview.vercel.app/api/extract");
    expect(getRequestOrigin(r)).toBe("https://my-preview.vercel.app");
  });
});

describe("getAppBaseUrlFromEnv", () => {
  const orig = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = orig;
  });

  it("strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000///";
    expect(getAppBaseUrlFromEnv()).toBe("http://localhost:3000");
  });
});

describe("resolveExtractionWorkerOrigin", () => {
  const origWorker = process.env.EXTRACTION_WORKER_BASE_URL;

  afterEach(() => {
    process.env.EXTRACTION_WORKER_BASE_URL = origWorker;
  });

  it("uses EXTRACTION_WORKER_BASE_URL when set", () => {
    process.env.EXTRACTION_WORKER_BASE_URL = "https://api.example.com/";
    const r = new Request("http://localhost:3000/api/extract");
    expect(resolveExtractionWorkerOrigin(r)).toBe("https://api.example.com");
  });

  it("falls back to request origin", () => {
    process.env.EXTRACTION_WORKER_BASE_URL = "";
    const r = new Request("https://preview.vercel.app/api/extract");
    expect(resolveExtractionWorkerOrigin(r)).toBe("https://preview.vercel.app");
  });

  it("falls back when EXTRACTION_WORKER_BASE_URL is unsafe (SSRF hardening)", () => {
    process.env.EXTRACTION_WORKER_BASE_URL = "http://127.0.0.1:3000";
    const r = new Request("https://good.example.com/api/extract");
    expect(resolveExtractionWorkerOrigin(r)).toBe("https://good.example.com");
  });
});
