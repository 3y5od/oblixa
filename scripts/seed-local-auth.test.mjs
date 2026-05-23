import assert from "node:assert/strict";
import test from "node:test";
import { resolveSeedUsers } from "./seed-local-auth.mjs";

const baseEnv = {
  E2E_TEST_EMAIL: "dev@oblixa.local",
  E2E_TEST_PASSWORD: "dev-password-12345",
};

test("resolveSeedUsers includes configured local test credentials", () => {
  const result = resolveSeedUsers({
    ...baseEnv,
    COMPREHENSIVE_PASS_EMAIL: "real-user@example.com",
    COMPREHENSIVE_PASS_PASSWORD: "real-password",
  });

  assert.equal(result.users.length, 2);
  assert.equal(result.users[0].email, "dev@oblixa.local");
  assert.equal(result.users[0].fullName, "Local Dev User");
  assert.equal(result.users[0].seedWorkspace, true);
  assert.equal(result.users[1].email, "real-user@example.com");
  assert.equal(result.users[1].fullName, null);
  assert.equal(result.users[1].seedWorkspace, false);
  assert.deepEqual(result.warnings, []);
});

test("resolveSeedUsers supports a configured local display name", () => {
  const result = resolveSeedUsers({
    ...baseEnv,
    COMPREHENSIVE_PASS_EMAIL: "configured@example.com",
    COMPREHENSIVE_PASS_PASSWORD: "configured-password",
    COMPREHENSIVE_PASS_FULL_NAME: "Configured Test User",
  });

  assert.equal(result.users.length, 2);
  assert.equal(result.users[1].email, "configured@example.com");
  assert.equal(result.users[1].fullName, "Configured Test User");
  assert.equal(result.users[1].seedWorkspace, false);
  assert.deepEqual(result.warnings, []);
});

test("resolveSeedUsers warns about incomplete configured local credentials", () => {
  const result = resolveSeedUsers({
    ...baseEnv,
    COMPREHENSIVE_PASS_EMAIL: "configured@example.com",
  });

  assert.equal(result.users.length, 1);
  assert.deepEqual(result.warnings, [
    "COMPREHENSIVE_PASS_EMAIL and COMPREHENSIVE_PASS_PASSWORD must both be set to seed that local login.",
  ]);
});
