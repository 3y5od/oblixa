import { describe, expect, it } from "vitest";
import { readOAuthProviderConfigFromConnection } from "@/lib/integrations/oauth-config";

describe("readOAuthProviderConfigFromConnection", () => {
  it("returns null when any required field is missing", () => {
    expect(
      readOAuthProviderConfigFromConnection({
        config_json: { authorizeUrl: "https://a", tokenUrl: "https://t", clientId: "id" },
      })
    ).toBeNull();
  });

  it("returns config when all fields are present", () => {
    const cfg = readOAuthProviderConfigFromConnection({
      config_json: {
        authorizeUrl: " https://a ",
        tokenUrl: "https://t",
        clientId: "id",
        clientSecret: "sec",
        scope: " s ",
      },
    });
    expect(cfg).toEqual({
      authorizeUrl: "https://a",
      tokenUrl: "https://t",
      clientId: "id",
      clientSecret: "sec",
      scope: "s",
    });
  });
});
