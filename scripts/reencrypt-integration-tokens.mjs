#!/usr/bin/env node
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const TOKEN_PREFIX_V1 = "enc:v1:";
const TOKEN_PREFIX_V2 = "enc:v2:";
const TOKEN_KEY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN_COLUMNS = ["access_token", "refresh_token"];

function activeTokenKeyId(env = process.env) {
  const kid = env.OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID?.trim() || "default";
  if (!TOKEN_KEY_ID_RE.test(kid)) throw new Error("Invalid OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID");
  return kid;
}

function tokenKeyEnvName(kid) {
  return `OBLIXA_TOKEN_ENCRYPTION_KEY_${kid.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function keyForKid(kid, env = process.env) {
  if (!TOKEN_KEY_ID_RE.test(kid)) throw new Error(`Invalid token key id: ${kid}`);
  const keyed = env[tokenKeyEnvName(kid)]?.trim();
  if (keyed) return keyed;
  if (kid === "default") return env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();
  return undefined;
}

function decodeKey(kid, env = process.env) {
  const raw = keyForKid(kid, env);
  if (!raw) throw new Error(`Missing token encryption key for kid ${kid}`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`Token encryption key for kid ${kid} must decode to 32 bytes`);
  return key;
}

export function decryptIntegrationTokenForMigration(ciphertext, env = process.env) {
  if (!ciphertext) return null;
  if (!ciphertext.startsWith(TOKEN_PREFIX_V1) && !ciphertext.startsWith(TOKEN_PREFIX_V2)) return ciphertext;

  if (ciphertext.startsWith(TOKEN_PREFIX_V1)) {
    const parts = ciphertext.slice(TOKEN_PREFIX_V1.length).split(":");
    if (parts.length !== 3) throw new Error("Invalid v1 token envelope");
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", decodeKey("default", env), Buffer.from(ivB64, "base64"), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  }

  const parts = ciphertext.slice(TOKEN_PREFIX_V2.length).split(":");
  if (parts.length !== 4) throw new Error("Invalid v2 token envelope");
  const [kid, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", decodeKey(kid, env), Buffer.from(ivB64, "base64"), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function encryptIntegrationTokenForMigration(plaintext, env = process.env) {
  if (!plaintext) return null;
  const kid = activeTokenKeyId(env);
  const key = decodeKey(kid, env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_PREFIX_V2}${kid}:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function planIntegrationTokenReencryption(rows, env = process.env) {
  const activeKid = activeTokenKeyId(env);
  return rows.map((row) => {
    const updates = {};
    for (const column of TOKEN_COLUMNS) {
      const value = row[column];
      if (!value) continue;
      if (typeof value === "string" && value.startsWith(`${TOKEN_PREFIX_V2}${activeKid}:`)) continue;
      const plaintext = decryptIntegrationTokenForMigration(value, env);
      updates[column] = encryptIntegrationTokenForMigration(plaintext, env);
    }
    return {
      id: row.id,
      organization_id: row.organization_id,
      provider: row.provider,
      updateColumns: Object.keys(updates),
      updates,
    };
  });
}

function parseArgs(argv) {
  const out = { write: false, input: null };
  for (const arg of argv) {
    if (arg === "--write") out.write = true;
    else if (arg.startsWith("--input=")) out.input = arg.slice("--input=".length);
    else if (arg === "--help") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/reencrypt-integration-tokens.mjs [--input=rows.json] [--write]");
    console.log("Default mode is dry-run. --write requires Supabase env and updates integration_connections.");
    return;
  }

  if (args.input) {
    const rows = JSON.parse(fs.readFileSync(args.input, "utf8"));
    const plan = planIntegrationTokenReencryption(Array.isArray(rows) ? rows : rows.rows ?? []);
    console.log(JSON.stringify({ mode: args.write ? "write" : "dry-run", rows: plan }, null, 2));
    if (args.write) {
      throw new Error("--write with --input is intentionally unsupported; use live Supabase mode for writes");
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or pass --input");

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, access_token, refresh_token")
    .or("access_token.not.is.null,refresh_token.not.is.null");
  if (error) throw error;
  const plan = planIntegrationTokenReencryption(data ?? []);
  const rowsNeedingUpdate = plan.filter((row) => row.updateColumns.length > 0);
  console.log(JSON.stringify({ mode: args.write ? "write" : "dry-run", rowsNeedingUpdate: rowsNeedingUpdate.length }, null, 2));

  if (!args.write) return;
  for (const row of rowsNeedingUpdate) {
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update(row.updates)
      .eq("id", row.id)
      .eq("organization_id", row.organization_id);
    if (updateError) throw updateError;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
