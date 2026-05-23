import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptIntegrationTokenForMigration,
  encryptIntegrationTokenForMigration,
  planIntegrationTokenReencryption,
} from "./reencrypt-integration-tokens.mjs";

const key = Buffer.alloc(32, 7).toString("base64");
const rotated = Buffer.alloc(32, 9).toString("base64");

test("planIntegrationTokenReencryption dry-runs plaintext and old envelopes into active v2 kid", () => {
  const legacyEnv = {
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
    OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID: "default",
  };
  const oldEnvelope = encryptIntegrationTokenForMigration("refresh-old", legacyEnv);
  const env = {
    INTEGRATION_TOKEN_ENCRYPTION_KEY: key,
    OBLIXA_TOKEN_ENCRYPTION_KEY_ROTATED: rotated,
    OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID: "rotated",
  };

  const [row] = planIntegrationTokenReencryption(
    [
      {
        id: "conn_1",
        organization_id: "org_1",
        provider: "slack",
        access_token: "plain-access",
        refresh_token: oldEnvelope,
      },
    ],
    env
  );

  assert.deepEqual(row.updateColumns.sort(), ["access_token", "refresh_token"]);
  assert.match(row.updates.access_token, /^enc:v2:rotated:/);
  assert.match(row.updates.refresh_token, /^enc:v2:rotated:/);
  assert.equal(decryptIntegrationTokenForMigration(row.updates.access_token, env), "plain-access");
  assert.equal(decryptIntegrationTokenForMigration(row.updates.refresh_token, env), "refresh-old");
});

test("planIntegrationTokenReencryption skips already-active envelopes", () => {
  const env = {
    OBLIXA_TOKEN_ENCRYPTION_KEY_ACTIVE: key,
    OBLIXA_ACTIVE_TOKEN_ENCRYPTION_KEY_ID: "active",
  };
  const activeEnvelope = encryptIntegrationTokenForMigration("access", env);

  const [row] = planIntegrationTokenReencryption(
    [{ id: "conn_2", organization_id: "org_1", provider: "crm", access_token: activeEnvelope, refresh_token: null }],
    env
  );

  assert.deepEqual(row.updateColumns, []);
  assert.deepEqual(row.updates, {});
});
