#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";

const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api");
const outPath = path.join(root, "openapi.yaml");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}

function routePathForFile(abs) {
  const rel = path.relative(apiRoot, path.dirname(abs)).replace(/\\/g, "/");
  const parts = rel.split("/").filter(Boolean);
  const converted = parts.map((part) => {
    const match = /^\[([^\]]+)]$/.exec(part);
    return match ? `{${match[1]}}` : part;
  });
  return `/api/${converted.join("/")}`.replace(/\/+$/, "");
}

function methodsFromSource(source) {
  return HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+async\\s+function\\s+${method.toUpperCase()}\\b`).test(source)
  );
}

function operationId(method, routePath) {
  const suffix = routePath
    .replace(/^\/api\/?/, "")
    .replace(/\{([^}]+)}/g, "by_$1")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${method}_${suffix || "root"}`;
}

function securityFor(routePath) {
  if (routePath === "/api/health") return [];
  if (routePath.includes("/cron/") || routePath === "/api/reminders/send") return [{ CronSecret: [] }];
  if (routePath.includes("/stripe/webhook") || routePath.includes("/webhooks/")) return [{ WebhookSignature: [] }];
  if (routePath.includes("/external-actions/") || routePath.includes("/reports/track/")) return [];
  return [{ SessionCookie: [] }];
}

function responsesFor(method, routePath) {
  const responses = {
    "200": { description: "OK" },
    "400": { description: "Bad request" },
    "401": { description: "Unauthorized" },
    "403": { description: "Forbidden" },
    "404": { description: "Not found" },
    "429": { description: "Rate limited" },
    "500": { description: "Unexpected server error" },
  };
  if (routePath.includes("/cron/")) {
    responses["207"] = { description: "Partial batch success" };
    responses["503"] = { description: "Server misconfigured or unavailable" };
  }
  if (method === "post" || method === "patch" || method === "put") {
    responses["409"] = { description: "Conflict" };
    responses["413"] = { description: "Payload too large" };
  }
  return responses;
}

const paths = {};
for (const file of walk(apiRoot).sort((a, b) => a.localeCompare(b))) {
  const routePath = routePathForFile(file);
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const methods = methodsFromSource(source);
  paths[routePath] = paths[routePath] ?? {};
  for (const method of methods) {
    paths[routePath][method] = {
      operationId: operationId(method, routePath),
      summary: `${method.toUpperCase()} ${routePath}`,
      description: `Generated route contract for ${rel}.`,
      security: securityFor(routePath),
      responses: responsesFor(method, routePath),
    };
  }
}

const doc = {
  openapi: "3.0.3",
  info: {
    title: "Oblixa route contract",
    version: "0.1.0",
  },
  components: {
    securitySchemes: {
      SessionCookie: { type: "apiKey", in: "cookie", name: "sb-access-token" },
      CronSecret: { type: "http", scheme: "bearer" },
      WebhookSignature: { type: "apiKey", in: "header", name: "stripe-signature" },
    },
  },
  paths,
};

fs.writeFileSync(outPath, stringify(doc, { lineWidth: 120 }));
console.log(`Wrote ${path.relative(root, outPath)} (${Object.keys(paths).length} paths)`);
