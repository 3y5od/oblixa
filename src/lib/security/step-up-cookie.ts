import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const STEP_UP_COOKIE_NAME = "oblixa_step_ok";

export type CookieJar = { get(name: string): { value?: string } | undefined };

const TTL_MS = 10 * 60 * 1000;

function isProductionLikeStepUpEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1" || env.VERCEL_ENV === "production";
}

export function getStepUpSigningSecret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.OBLIXA_STEP_UP_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (isProductionLikeStepUpEnv(env)) {
    throw new Error("[step-up] Missing required OBLIXA_STEP_UP_SECRET for production step-up signing");
  }
  return "";
}

function sign(userId: string, exp: number, nonce: string): string {
  const secret = getStepUpSigningSecret();
  if (!secret) return "";
  const payload = `${userId}.${exp}.${nonce}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

function parseAndVerify(raw: string, userId: string): boolean {
  const secret = getStepUpSigningSecret();
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

/**
 * SPEC: security-page-maximal-pass §16.1 — expose the cookie's exp
 * claim so the settings UI can render a CountdownChip showing time
 * remaining until step-up TTL elapses. Returns `{ active, expiresAt }`
 * where `active` mirrors `isStepUpCookieValidForUser`. The TTL is
 * 10 minutes (see TTL_MS); clients should add a 30s skew buffer
 * before treating the value as expired (§16.17).
 */
export function readStepUpExpiry(
  jar: CookieJar,
  userId: string
): { active: boolean; expiresAt: number | null } {
  const raw = jar.get(STEP_UP_COOKIE_NAME)?.value;
  if (!raw) return { active: false, expiresAt: null };
  const secret = getStepUpSigningSecret();
  if (!secret) return { active: false, expiresAt: null };
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { active: false, expiresAt: null };
  const payloadB64 = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return { active: false, expiresAt: null };
  }
  const expectedMac = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { active: false, expiresAt: null };
  }
  const parts = payload.split(".");
  if (parts.length !== 3) return { active: false, expiresAt: null };
  const [uid, expStr] = parts;
  if (uid !== userId) return { active: false, expiresAt: null };
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return { active: false, expiresAt: null };
  return { active: Date.now() <= exp, expiresAt: exp };
}
