#!/usr/bin/env node
import tls from "node:tls";

const strict = process.env.CERT_STRICT === "1" || process.env.CERT_STRICT === "true";
const hosts = (process.env.PUBLIC_HOSTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (!strict || !hosts.length) {
  console.log(JSON.stringify({ ok: true, mode: "skipped", strict, hostCount: hosts.length }, null, 2));
  process.exit(0);
}

function check(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.valid_to) return resolve({ host, ok: false, reason: "no_cert" });
      const exp = new Date(cert.valid_to).getTime();
      resolve({ host, ok: exp > Date.now(), validTo: cert.valid_to });
    });
    socket.on("error", () => resolve({ host, ok: false, reason: "tls_error" }));
    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({ host, ok: false, reason: "timeout" });
    });
  });
}

const results = [];
for (const h of hosts) {
  results.push(await check(h));
}
const ok = results.every((r) => r.ok);
console.log(JSON.stringify({ ok, results }, null, 2));
process.exit(ok ? 0 : 1);
