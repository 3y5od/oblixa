/** Strip Discord-flavored mass pings and javascript URLs from outbound embed JSON text. */
export function sanitizeDiscordEmbedSnippet(text: string): string {
  return text
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@here/gi, "@ here")
    .replace(/javascript:/gi, "javascript\u200b:");
}
