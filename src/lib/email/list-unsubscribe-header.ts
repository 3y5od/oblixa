/** RFC 5322 header values must not contain bare CR/LF (injection / smuggling). */
export function assertNoCrlfInHeaderValue(value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error("header_value_contains_crlf");
  }
}

/** RFC 8058 one-click body shape (application/x-www-form-urlencoded). */
export function buildListUnsubscribePostBody(token: string): string {
  assertNoCrlfInHeaderValue(token);
  const params = new URLSearchParams();
  params.set("List-Unsubscribe", "One-Click");
  params.set("token", token);
  return params.toString();
}
