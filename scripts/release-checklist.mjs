/**
 * Runs the full local release gate: preflight → verify → production server →
 * comprehensive-pass (against localhost) → Playwright (reusing the same server).
 *
 * Cron checks use localhost so they validate this build; a remote
 * COMPREHENSIVE_PASS_BASE_URL can 404 V5 crons if that deploy is behind.
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const cwd = process.cwd();
const localBase = "http://127.0.0.1:3000";

function run(cmd, args, env = process.env) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd, env });
  const elapsedMs = Date.now() - started;
  console.log(JSON.stringify({ step: `${cmd} ${args.join(" ")}`, status: r.status ?? 1, elapsedMs }));
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

async function waitForServer(probeUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(probeUrl, { signal: AbortSignal.timeout(3000) });
      if (res.status < 500) {
        return;
      }
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${probeUrl} (is port 3000 free?)`);
}

async function main() {
  run("npm", ["run", "preflight:release"]);
  run("npm", ["run", "verify"]);

  const server = spawn("npm", ["run", "start"], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" },
  });

  const shutdown = () => {
    if (server.killed) return;
    try {
      server.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await waitForServer(`${localBase}/api/reminders/send`, 120_000);
    run("node", ["scripts/comprehensive-pass.mjs"], {
      ...process.env,
      COMPREHENSIVE_PASS_BASE_URL: localBase,
    });
    run("npx", ["playwright", "test"], {
      ...process.env,
      PLAYWRIGHT_BASE_URL: localBase,
    });
    run("npm", ["run", "check:e2e:stability-threshold"], {
      ...process.env,
      PLAYWRIGHT_JSON_REPORT: "test-results/playwright-report.json",
    });
    run("npm", ["run", "report:ci-provenance"]);
  } finally {
    shutdown();
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
