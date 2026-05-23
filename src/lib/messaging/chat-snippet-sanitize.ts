import { redactOutboundMessageText } from "@/lib/messaging/outbound-payload-scrub";

/**
 * Strip risky Slack-style patterns from outbound snippets (no @channel / @everyone / javascript links).
 */
export function sanitizeChatSnippet(text: string): string {
  return redactOutboundMessageText(text)
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@channel/gi, "@ channel")
    .replace(/@here/gi, "@ here")
    .replace(/javascript:/gi, "javascript\u200b:")
    .replace(/vbscript:/gi, "vbscript\u200b:")
    .replace(/data:text\/html/gi, "data\u200b:text/html")
    .replace(/<\/?script/gi, "<scr\u200bipt")
    .replace(/<https?:\/\//gi, "<hxxp://");
}
