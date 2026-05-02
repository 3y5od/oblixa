import { spawnSync } from "node:child_process";

export default async function globalTeardown() {
  if (process.env.E2E_TEARDOWN === "1" || process.env.E2E_TEARDOWN === "true") {
    const r = spawnSync("npm", ["run", "test:e2e:teardown"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (r.status !== 0) {
      process.stderr.write(`[playwright teardown] test:e2e:teardown exited ${r.status}\n`);
    }
  }
  process.stdout.write(`[playwright teardown] finished at ${new Date().toISOString()}\n`);
}
