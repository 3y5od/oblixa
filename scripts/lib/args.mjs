#!/usr/bin/env node

export function hasFlag(flag, argv = process.argv.slice(2)) {
  return argv.includes(flag);
}

export function getPositionalArgs(argv = process.argv.slice(2)) {
  return argv.filter((arg) => !arg.startsWith("-"));
}

export function parseCommonFlags(argv = process.argv.slice(2)) {
  return {
    strict: hasFlag("--strict", argv),
    report: hasFlag("--report", argv),
    json: hasFlag("--json", argv),
    failOnFindings: hasFlag("--fail-on-findings", argv),
  };
}

export function passThroughFlags(argv = process.argv.slice(2), skip = []) {
  const skipSet = new Set(skip);
  return argv.filter((arg) => !skipSet.has(arg));
}
