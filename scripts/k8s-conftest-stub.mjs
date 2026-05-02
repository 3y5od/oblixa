#!/usr/bin/env node
/**
 * Placeholder for Kyverno/conftest against rendered manifests.
 * K8S_POLICY_STRICT=1 will fail if no policy bundle is registered (opt-in ratchet).
 */
import fs from "node:fs";
import path from "node:path";

const strict = process.env.K8S_POLICY_STRICT === "1" || process.env.K8S_POLICY_STRICT === "true";
const bundle = path.join(process.cwd(), "k8s", "conftest-policies");
const hasBundle = fs.existsSync(bundle);
const ok = !strict || hasBundle;
console.log(JSON.stringify({ ok, strict, checkId: "k8s-conftest-stub", hasBundle }, null, 2));
process.exit(ok ? 0 : 1);
