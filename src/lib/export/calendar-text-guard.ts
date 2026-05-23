/** RFC 5545-style line folding: first segment up to `maxLen` octets; continuations are CRLF + space + up to `maxLen - 1` octets. */
export function foldIcsTextLine(line: string, maxLen = 75): string {
  if (line.length <= maxLen) return line;
  let out = line.slice(0, maxLen);
  let pos = maxLen;
  while (pos < line.length) {
    const take = maxLen - 1;
    out += `\r\n ${line.slice(pos, pos + take)}`;
    pos += take;
  }
  return out;
}

/** vCard 3.0/4.0 escaping for VALUES (backslash, newline, comma, semicolon). */
export function escapeVcardValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function escapeIcsTextValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
