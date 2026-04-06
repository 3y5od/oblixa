/**
 * Safely read JSON from a Response (avoids HTML error pages / empty bodies breaking JSON.parse).
 */
export async function readApiJson<T extends Record<string, unknown>>(
  response: Response
): Promise<{
  data: T;
  isJson: boolean;
  rawPreview: string;
}> {
  const raw = await response.text();
  const preview =
    raw.length > 400 ? `${raw.slice(0, 400)}…` : raw || "(empty body)";
  const ct = (response.headers.get("content-type") ?? "").toLowerCase();
  const looksJson =
    ct.includes("application/json") ||
    ct.includes("application/problem+json") ||
    /^[\s]*[{[]/.test(raw);
  if (!looksJson) {
    return { data: {} as T, isJson: false, rawPreview: preview };
  }
  try {
    return { data: JSON.parse(raw) as T, isJson: true, rawPreview: preview };
  } catch {
    return { data: {} as T, isJson: false, rawPreview: preview };
  }
}
