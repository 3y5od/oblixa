import { describe, expect, it } from "vitest";
import { Agent, MockAgent, setGlobalDispatcher } from "undici";

describe("undici MockAgent upstream contract (MSW-style integration)", () => {
  it("intercepts fetch to a synthetic API host", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    try {
      agent.get("https://oblixa-upstream-contract.test").intercept({ path: "/v1/status", method: "GET" }).reply(200, {
        ok: true,
      });

      const res = await fetch("https://oblixa-upstream-contract.test/v1/status");
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    } finally {
      await agent.close().catch(() => {});
      setGlobalDispatcher(new Agent());
    }
  });
});
