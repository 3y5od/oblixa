#!/usr/bin/env node
/**
 * Post-E2E hygiene: optional webhook POST, optional Supabase table purge (allowlist only).
 * Safe default: no-op exit 0 unless E2E_TEARDOWN=1.
 */
import { request } from "node:http";
import { request as httpsRequest } from "node:https";

const enabled = process.env.E2E_TEARDOWN === "1" || process.env.E2E_TEARDOWN === "true";
if (!enabled) {
  process.exit(0);
}

async function postWebhook(urlStr, body) {
  const u = new URL(urlStr);
  const lib = u.protocol === "https:" ? httpsRequest : request;
  return new Promise((resolve, reject) => {
    const req = lib(
      u,
      {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "oblixa-e2e-teardown/1" },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const webhook = process.env.E2E_TEARDOWN_WEBHOOK_URL;
if (webhook) {
  try {
    const status = await postWebhook(webhook, { event: "e2e_teardown", at: new Date().toISOString() });
    process.stdout.write(`[e2e-teardown] webhook status ${status}\n`);
  } catch (e) {
    process.stderr.write(`[e2e-teardown] webhook error: ${e?.message || e}\n`);
    if (process.env.E2E_TEARDOWN_STRICT === "1") process.exit(1);
  }
}

const tables = (process.env.E2E_TEARDOWN_TABLES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const rpc = process.env.E2E_TEARDOWN_RPC;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (tables.length && url && key) {
  process.stdout.write(
    `[e2e-teardown] Supabase purge requested for tables=${tables.join("|")}; implement RPC/delete per org policy before production use.\n`
  );
  if (rpc) {
    process.stdout.write(`[e2e-teardown] E2E_TEARDOWN_RPC=${rpc} (not executed — wire @supabase/supabase-js admin client if needed).\n`);
  }
} else if (tables.length) {
  process.stderr.write("[e2e-teardown] E2E_TEARDOWN_TABLES set but Supabase URL/key missing; skipping DB purge.\n");
  if (process.env.E2E_TEARDOWN_STRICT === "1") process.exit(1);
}

process.exit(0);
