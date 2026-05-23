import { redactOutboundMessageText } from "@/lib/messaging/outbound-payload-scrub";

/** Strip Discord-flavored mass pings and javascript URLs from outbound embed JSON text. */
export function sanitizeDiscordEmbedSnippet(text: string): string {
  return redactOutboundMessageText(text)
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@here/gi, "@ here")
    .replace(/javascript:/gi, "javascript\u200b:")
    .replace(/vbscript:/gi, "vbscript\u200b:")
    .replace(/data:text\/html/gi, "data\u200b:text/html")
    .replace(/<\/?script/gi, "<scr\u200bipt");
}
