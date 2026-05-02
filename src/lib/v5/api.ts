import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SUBMIT_TICKET_TTL_MS = 15 * 60 * 1000;

const DEV_EXTERNAL_PEPPER_FALLBACK = "oblixa-dev-external-pepper";

function isProductionLikeEnv(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

/**
 * HMAC key for external submit tickets. Production-like env requires
 * `EXTERNAL_ACTION_SUBMIT_TICKET_SECRET` (must not reuse CRON_SECRET or the passcode pepper).
 */
function externalSubmitTicketSecret(): string {
  const submit = process.env.EXTERNAL_ACTION_SUBMIT_TICKET_SECRET?.trim();
  if (isProductionLikeEnv()) {
    if (submit) return submit;
    throw new Error(
      "[v5] Missing EXTERNAL_ACTION_SUBMIT_TICKET_SECRET for external submit tickets (CRON_SECRET and EXTERNAL_ACTION_PASSCODE_PEPPER are not allowed for this HMAC in production)"
    );
  }
  const pepper = process.env.EXTERNAL_ACTION_PASSCODE_PEPPER?.trim();
  const resolved = submit ?? pepper ?? process.env.CRON_SECRET?.trim();
  if (resolved) return resolved;
  return DEV_EXTERNAL_PEPPER_FALLBACK;
}

/**
 * When `requires_reauth` is true on a link, the participant must call GET status (step-up),
 * receive `submitTicket`, and include it in the POST submit body. Ticket is HMAC-bound to
 * link id + URL token and expires in 15 minutes.
 */
export function signExternalSubmitTicket(input: { linkId: string; urlToken: string }): string {
  const exp = Date.now() + SUBMIT_TICKET_TTL_MS;
  const body = JSON.stringify({ lid: input.linkId, t: input.urlToken, exp });
  const sig = createHmac("sha256", externalSubmitTicketSecret()).update(body, "utf8").digest("base64url");
  return Buffer.from(JSON.stringify({ lid: input.linkId, t: input.urlToken, exp, sig }), "utf8").toString(
    "base64url"
  );
}

export function verifyExternalSubmitTicket(
  urlToken: string,
  ticket: string | undefined,
  expectedLinkId: string
): { ok: true } | { ok: false; reason: string } {
  if (!ticket || typeof ticket !== "string") {
    return { ok: false, reason: "submit_ticket_required" };
  }
  try {
    const raw = JSON.parse(Buffer.from(ticket, "base64url").toString("utf8")) as {
      lid?: string;
      t?: string;
      exp?: number;
      sig?: string;
    };
    if (raw.lid !== expectedLinkId) return { ok: false, reason: "submit_ticket_invalid" };
    if (raw.t !== urlToken) return { ok: false, reason: "submit_ticket_invalid" };
    if (typeof raw.exp !== "number" || Date.now() > raw.exp) {
      return { ok: false, reason: "submit_ticket_expired" };
    }
    if (typeof raw.lid !== "string" || typeof raw.sig !== "string") {
      return { ok: false, reason: "submit_ticket_invalid" };
    }
    const body = JSON.stringify({ lid: raw.lid, t: raw.t, exp: raw.exp });
    const expected = createHmac("sha256", externalSubmitTicketSecret()).update(body, "utf8").digest("base64url");
    try {
      if (!timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(raw.sig, "utf8"))) {
        return { ok: false, reason: "submit_ticket_invalid" };
      }
    } catch {
      return { ok: false, reason: "submit_ticket_invalid" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "submit_ticket_invalid" };
  }
}

export function readJsonBody<T>(input: unknown, fallback: T): T {
  if (!input || typeof input !== "object") return fallback;
  return input as T;
}

export function toSafeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clampConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return Number(parsed.toFixed(2));
}

function resolvePasscodePepper(): string {
  const pepper = process.env.EXTERNAL_ACTION_PASSCODE_PEPPER?.trim();
  if (isProductionLikeEnv()) {
    if (pepper) return pepper;
    throw new Error(
      "[v5] Missing secret for external passcodes: set EXTERNAL_ACTION_PASSCODE_PEPPER (CRON_SECRET is not allowed in production)"
    );
  }
  const resolved = pepper ?? process.env.CRON_SECRET?.trim();
  if (resolved) return resolved;
  return DEV_EXTERNAL_PEPPER_FALLBACK;
}

export function hashExternalPasscode(plain: string): string {
  const secret = resolvePasscodePepper();
  return createHash("sha256").update(`${secret}:${plain}`, "utf8").digest("hex");
}

export function verifyExternalPasscode(plain: string | undefined, storedHash: string | null): boolean {
  if (!storedHash) return true;
  if (!plain) return false;
  const computed = hashExternalPasscode(plain);
  try {
    return timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(storedHash, "utf8"));
  } catch {
    return false;
  }
}
