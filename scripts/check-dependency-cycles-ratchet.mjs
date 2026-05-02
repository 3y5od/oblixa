#!/usr/bin/env node
/**
 * Ratchet placeholder: fail only when QA_DEPENDENCY_CYCLES_STRICT=1 and baseline marker missing.
 * Plan: dependency-cycles-ratchet — extend with madge/depcruise when adopted.
 */
import fs from "node:fs";

const strict = process.env.QA_DEPENDENCY_CYCLES_STRICT === "1";
const marker = ".qa-dependency-cycles-baseline";
const exists = fs.existsSync(marker);
console.log(JSON.stringify({ checkId: "dependency-cycles-ratchet", strict, markerExists: exists }, null, 2));
process.exit(strict && !exists ? 1 : 0);
