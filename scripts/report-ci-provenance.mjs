#!/usr/bin/env node
import process from "node:process";

const payload = {
  generatedAt: new Date().toISOString(),
  ci: process.env.CI === "true",
  run: {
    id: process.env.GITHUB_RUN_ID ?? "",
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
    workflow: process.env.GITHUB_WORKFLOW ?? "",
    ref: process.env.GITHUB_REF ?? "",
    sha: process.env.GITHUB_SHA ?? "",
    actor: process.env.GITHUB_ACTOR ?? "",
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
};

console.log(JSON.stringify(payload, null, 2));
