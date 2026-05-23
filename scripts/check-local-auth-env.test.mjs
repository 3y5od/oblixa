import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeLocalAuthEnv, parseDotenv } from "./check-local-auth-env.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-auth-env-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("parseDotenv reads simple quoted and unquoted values", () => {
  assert.deepEqual(parseDotenv("A=one\nB='two'\nC=\"three\"\n# D=four\n"), {
    A: "one",
    B: "two",
    C: "three",
  });
});

test("analyzeLocalAuthEnv accepts localhost app and Supabase auth", async () => {
  await withFixture(
    {
      ".env.local": `
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-local
SUPABASE_SERVICE_ROLE_KEY=service-local
`,
    },
    async (root) => {
      const report = await analyzeLocalAuthEnv(root, {
        baseEnv: {},
        fetch: async () => ({ status: 400 }),
      });
      assert.equal(report.ok, true);
      assert.deepEqual(report.issues, []);
    }
  );
});

test("analyzeLocalAuthEnv rejects production app URL and remote Supabase in local dev", async () => {
  await withFixture(
    {
      ".env.local": `
NEXT_PUBLIC_APP_URL=https://oblixa.io
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
SUPABASE_SERVICE_ROLE_KEY=service
`,
    },
    async (root) => {
      const report = await analyzeLocalAuthEnv(root, {
        baseEnv: {},
        checkReachability: false,
      });
      assert.equal(report.ok, false);
      assert.equal(report.issues.some((item) => item.code === "local_app_url_not_localhost"), true);
      assert.equal(report.issues.some((item) => item.code === "local_dev_uses_remote_supabase"), true);
    }
  );
});

test("analyzeLocalAuthEnv rejects unreachable local auth service", async () => {
  await withFixture(
    {
      ".env.local": `
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
SUPABASE_SERVICE_ROLE_KEY=service
`,
    },
    async (root) => {
      const report = await analyzeLocalAuthEnv(root, {
        baseEnv: {},
        fetch: async () => {
          throw new Error("ECONNREFUSED");
        },
      });
      assert.equal(report.ok, false);
      assert.equal(report.issues.some((item) => item.code === "supabase_auth_unreachable"), true);
    }
  );
});

test("analyzeLocalAuthEnv rejects accidental public service-role key", async () => {
  await withFixture(
    {
      ".env.local": `
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon
SUPABASE_SERVICE_ROLE_KEY=service
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=service
`,
    },
    async (root) => {
      const report = await analyzeLocalAuthEnv(root, {
        baseEnv: {},
        checkReachability: false,
      });
      assert.equal(report.ok, false);
      assert.equal(report.issues.some((item) => item.code === "service_role_key_public"), true);
    }
  );
});
