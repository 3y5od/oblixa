import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import Stripe from "stripe";

const require = createRequire(fileURLToPath(import.meta.url));
const { NodeCryptoProvider } = require(
  fileURLToPath(new URL("../../node_modules/stripe/cjs/crypto/NodeCryptoProvider.js", import.meta.url))
) as { NodeCryptoProvider: new () => object };

describe("Stripe webhook signature contract", () => {
  it("constructEvent accepts a valid signed payload", () => {
    const secret = "whsec_" + "a".repeat(32);
    const stripe = new Stripe("sk_test_placeholder", { typescript: true, apiVersion: "2026-04-22.dahlia" });
    const payload = JSON.stringify({
      id: "evt_contract_test",
      object: "event",
      type: "billing_portal.configuration.created",
      data: { object: {} },
    });
    const ts = Math.floor(Date.now() / 1000);
    const header = stripe.webhooks.generateTestHeaderString({
      timestamp: ts,
      payload,
      secret,
      scheme: "v1",
      signature: "",
      cryptoProvider: new NodeCryptoProvider() as never,
    });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.id).toBe("evt_contract_test");
  });

  it("constructEvent rejects tampered payload", () => {
    const secret = "whsec_" + "b".repeat(32);
    const stripe = new Stripe("sk_test_placeholder", { typescript: true, apiVersion: "2026-04-22.dahlia" });
    const payload = JSON.stringify({ id: "evt_tamper", object: "event", type: "ping", data: {} });
    const ts = Math.floor(Date.now() / 1000);
    const header = stripe.webhooks.generateTestHeaderString({
      timestamp: ts,
      payload,
      secret,
      scheme: "v1",
      signature: "",
      cryptoProvider: new NodeCryptoProvider() as never,
    });
    const tampered = payload.replace("ping", "pong");
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
  });
});
