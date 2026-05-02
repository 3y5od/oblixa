import { describe, expect, it } from "vitest";
import { sanitizeDiscordEmbedSnippet } from "./discord-embed-snippet-sanitize";

describe("sanitizeDiscordEmbedSnippet", () => {
  it("defangs @everyone", () => {
    expect(sanitizeDiscordEmbedSnippet('{"description":"ping @everyone"}')).not.toContain("@everyone");
  });
});
