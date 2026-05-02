#!/usr/bin/env node
/** Env-gated cosign/SLSA verify scripts exist (plan: container-signing-slsa). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const hasCosign = !!pkg.scripts?.["verify-cosign-artifact"];
const hasSlsa = !!pkg.scripts?.["verify-slsa-attestation"];
const ok = hasCosign && hasSlsa;
console.log(JSON.stringify({ checkId: "container-signing-slsa", ok, hasCosign, hasSlsa }, null, 2));
process.exit(ok ? 0 : 1);
