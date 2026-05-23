import { redactOutboundMessageText } from "@/lib/messaging/outbound-payload-scrub";

/**
 * Strip obvious injection tokens from outbound Teams-style Adaptive Card JSON snippets.
 */
export function sanitizeAdaptiveCardSnippet(jsonText: string): string {
  return redactOutboundMessageText(jsonText)
    .replace(/@everyone/gi, "@ everyone")
    .replace(/javascript:/gi, "javascript\u200b:")
    .replace(/vbscript:/gi, "vbscript\u200b:")
    .replace(/data:text\/html/gi, "data\u200b:text/html")
    .replace(/<\/?script/gi, "<scr\u200bipt");
}
