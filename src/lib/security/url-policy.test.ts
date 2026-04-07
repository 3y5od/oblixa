import { describe, expect, it } from "vitest";
import { validateOutboundHttpUrl } from "@/lib/security/url-policy";

describe("validateOutboundHttpUrl", () => {
  it("accepts a normal public https URL", () => {
    const result = validateOutboundHttpUrl("https://api.example.com/webhook");
    expect(result?.toString()).toBe("https://api.example.com/webhook");
  });

  it("rejects localhost and private IPv4 literals", () => {
    expect(validateOutboundHttpUrl("http://localhost:3000")).toBeNull();
    expect(validateOutboundHttpUrl("http://127.0.0.1:8080")).toBeNull();
    expect(validateOutboundHttpUrl("http://192.168.1.42/hook")).toBeNull();
  });

  it("rejects reserved non-public IPv4 ranges", () => {
    expect(validateOutboundHttpUrl("http://0.0.0.0/internal")).toBeNull();
    expect(validateOutboundHttpUrl("http://100.64.10.20/internal")).toBeNull();
    expect(validateOutboundHttpUrl("http://198.18.0.1/internal")).toBeNull();
  });

  it("rejects private IPv6 and mapped loopback", () => {
    expect(validateOutboundHttpUrl("http://[::1]/internal")).toBeNull();
    expect(validateOutboundHttpUrl("http://[::]/internal")).toBeNull();
    expect(validateOutboundHttpUrl("http://[::ffff:127.0.0.1]/internal")).toBeNull();
  });
});
