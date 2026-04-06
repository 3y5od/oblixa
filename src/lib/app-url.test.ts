import { describe, it, expect, afterEach } from "vitest";
import { getAppBaseUrlFromEnv, getRequestOrigin } from "@/lib/app-url";

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
