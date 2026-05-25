#!/usr/bin/env node
/**
 * Static check: in-page hash links (href="#id" or href: "#id") must target an element id
 * declared somewhere under src/. Does not model <details> nesting across files — use manual
 * review + DetailsOpenOnHash for that case.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const srcRoot = path.join(cwd, "src");

const ALLOWLIST_HASHES = new Set([
  "main-content", // skip link
]);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      yield* walk(full);
    } else if (
      e.isFile() &&
      !/\.(?:test|spec)\.[cm]?[tj]sx?$/u.test(e.name) &&
      (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))
    ) {
      yield full;
    }
  }
}

function rel(p) {
  return path.relative(cwd, p).split(path.sep).join("/");
}

const hashHrefRe = /href\s*=\s*["']#([a-zA-Z][\w-]*)["']/g;
const hashPropRe = /href:\s*["']#([a-zA-Z][\w-]*)["']/g;
const idAttrRe = /\bid\s*=\s*["']([a-zA-Z][\w-]*)["']/g;

async function main() {
  const allIds = new Set();
  const hashRefs = [];

  for await (const file of walk(srcRoot)) {
    const r = rel(file);
    const text = await fs.readFile(file, "utf8");

    let m;
    const idRe = new RegExp(idAttrRe.source, "g");
    while ((m = idRe.exec(text)) !== null) {
      allIds.add(m[1]);
    }

    const collect = (regex) => {
      let x;
      while ((x = regex.exec(text)) !== null) {
        hashRefs.push({ id: x[1], file: r });
      }
    };
    collect(new RegExp(hashHrefRe.source, "g"));
    collect(new RegExp(hashPropRe.source, "g"));
  }

  const missing = hashRefs.filter((h) => !ALLOWLIST_HASHES.has(h.id) && !allIds.has(h.id));

  if (missing.length === 0) {
    console.log("PASS check-client-hash-details: all in-app hash targets have a matching id in src");
    process.exit(0);
  }

  console.error("FAIL check-client-hash-details: hash links with no matching id= in src:");
  for (const h of missing) {
    console.error(`  #${h.id} referenced in ${h.file}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
