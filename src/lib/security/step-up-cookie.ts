import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const STEP_UP_COOKIE_NAME = "oblixa_step_ok";

export type CookieJar = { get(name: string): { value?: string } | undefined };

const TTL_MS = 10 * 60 * 1000;

function stepUpSecret(): string {
  const s = process.env.OBLIXA_STEP_UP_SECRET?.trim();
  if (s && s.length >= 16) return s;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (fallback && fallback.length >= 16) return `su:${fallback.slice(0, 32)}`;
  return "";
}

function sign(userId: string, exp: number, nonce: string): string {
  const secret = stepUpSecret();
  if (!secret) return "";
  const payload = `${userId}.${exp}.${nonce}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

function parseAndVerify(raw: string, userId: string): boolean {
  const secret = stepUpSecret();
  if (!secret) return false;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expectedMac = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const parts = payload.split(".");
  if (parts.length !== 3) return false;
  const [uid, expStr] = parts;
  if (uid !== userId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function mintStepUpCookieValue(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const nonce = randomBytes(16).toString("hex");
  return sign(userId, exp, nonce);
}

export function isStepUpCookieValidForUser(jar: CookieJar, userId: string): boolean {
  const raw = jar.get(STEP_UP_COOKIE_NAME)?.value;
  if (!raw) return false;
  return parseAndVerify(raw, userId);
}
