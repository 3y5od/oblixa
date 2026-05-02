/**
 * Strip risky Slack-style patterns from outbound snippets (no @channel / @everyone / javascript links).
 */
export function sanitizeChatSnippet(text: string): string {
  return text
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@channel/gi, "@ channel")
    .replace(/@here/gi, "@ here")
    .replace(/javascript:/gi, "javascript\u200b:")
    .replace(/<https?:\/\//gi, "<hxxp://");
}
