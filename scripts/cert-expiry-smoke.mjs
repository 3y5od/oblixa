#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import process from "node:process";

const strict = process.env.CERT_STRICT === "1" || process.env.CERT_STRICT === "true";
const timeoutMs = Number.parseInt(process.env.CERT_TIMEOUT_MS || "8000", 10);
const minDays = Number.parseInt(process.env.CERT_MIN_DAYS || "30", 10);
const hosts = (process.env.PUBLIC_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function parseSubjectAltNames(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().replace(/^DNS:/i, ""))
    .filter(Boolean);
}

function sanMatchesHost(sans, host) {
  return sans.some((san) => san === host || (san.startsWith("*.") && host.endsWith(san.slice(1))));
}

function checkTls(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, minVersion: "TLSv1.2" }, () => {
      const cert = socket.getPeerCertificate();
      const protocol = socket.getProtocol();
      socket.destroy();
      if (!cert || !cert.valid_to) {
        resolve({ host, ok: false, reason: "no_cert", protocol });
        return;
      }
      const validToMs = new Date(cert.valid_to).getTime();
      const daysRemaining = Math.floor((validToMs - Date.now()) / 86_400_000);
      const subjectAltNames = parseSubjectAltNames(cert.subjectaltname);
      const issuer = cert.issuer?.O || cert.issuer?.CN || null;
      const issues = [];
      if (daysRemaining < minDays) issues.push("tls_certificate_expiring");
      if (!issuer) issues.push("tls_issuer_missing");
      if (!sanMatchesHost(subjectAltNames, host)) issues.push("tls_san_missing_host");
      if (!protocol || !/^TLSv1\.[23]$/i.test(protocol)) issues.push("tls_protocol_below_minimum");
      resolve({ host, ok: issues.length === 0, validTo: cert.valid_to, daysRemaining, issuer, subjectAltNames, protocol, issues });
    });
    socket.on("error", (error) => resolve({ host, ok: false, reason: error?.code || "tls_error", issues: ["tls_connection_failed"] }));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ host, ok: false, reason: "timeout", issues: ["tls_timeout"] });
    });
  });
}

function requestUrl(url, maxBytes = 262144) {
  return new Promise((resolve) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (body.length < maxBytes) body += chunk.slice(0, maxBytes - body.length);
      });
      res.on("end", () => resolve({ statusCode: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ statusCode: 0, headers: {}, body: "", error: "timeout" });
    });
    req.on("error", (error) => resolve({ statusCode: 0, headers: {}, body: "", error: error?.code || "request_error" }));
  });
}

async function checkHttpEdge(host) {
  const httpResult = await requestUrl(`http://${host}/`, 0);
  const location = String(httpResult.headers.location || "");
  const redirectsToHttps = [301, 302, 307, 308].includes(httpResult.statusCode) && location.startsWith(`https://${host}`);
  const httpsResult = await requestUrl(`https://${host}/`);
  const hstsHeader = String(httpsResult.headers["strict-transport-security"] || "");
  const mixedContentUrls = [...httpsResult.body.matchAll(/\bhttp:\/\/[^\s"'<>]+/gi)].map((match) => match[0]).slice(0, 10);
  const issues = [];
  if (!redirectsToHttps) issues.push("edge_http_redirect_missing");
  if (!/max-age=\d+/i.test(hstsHeader)) issues.push("edge_hsts_missing");
  if (mixedContentUrls.length > 0) issues.push("edge_mixed_content_risk");
  return { host, ok: issues.length === 0, redirectsToHttps, hstsHeader: hstsHeader ? "<present>" : null, mixedContentUrls, issues };
}

if (!strict || !hosts.length) {
  console.log(JSON.stringify({ ok: true, mode: "skipped", strict, hostCount: hosts.length, minDays, timeoutMs }, null, 2));
  process.exit(0);
}

const results = [];
for (const host of hosts) {
  const tlsResult = await checkTls(host);
  const edgeResult = await checkHttpEdge(host);
  const issues = [...(tlsResult.issues || []), ...(edgeResult.issues || [])];
  results.push({ host, ok: tlsResult.ok && edgeResult.ok, tls: tlsResult, edge: edgeResult, issueCount: issues.length, issues });
}

const report = {
  ok: results.every((result) => result.ok),
  mode: "strict_read_only_tls_edge",
  minDays,
  timeoutMs,
  results,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
