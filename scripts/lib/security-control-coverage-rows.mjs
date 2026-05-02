/**
 * Canonical SEC control rows for artifacts/security-control-coverage-matrix.rows.json
 * Generated list mirrors the autonomous security program plan (Appendices A, C, E).
 * M_refs default: out-of-repo manual / org evidence (no markdown in docs/).
 */
const M = "out-of-repo manual / org evidence (no in-repo markdown)";
const E = "scripts/check-security-control-coverage.mjs";

function row(sec_id, title, o = {}) {
  return {
    sec_id,
    title,
    I_refs: o.I ?? "",
    T_refs: o.T ?? "",
    E_refs: o.E ?? E,
    M_refs: o.M ?? M,
    priority: o.priority ?? "P3",
    owner_team: o.owner_team ?? "engineering",
    n_a_rationale: o.n_a_rationale ?? null,
    n_a_reviewed_at: o.n_a_reviewed_at ?? null,
    supersedes: o.supersedes ?? null,
  };
}

function naRow(sec_id, title, rationale, mRef = M) {
  return row(sec_id, title, {
    I_refs: "",
    T_refs: "",
    E_refs: E,
    M_refs: mRef,
    priority: "SDLC",
    n_a_rationale: rationale,
    n_a_reviewed_at: "2026-04-28",
  });
}

export function buildAllCoverageRows() {
  const out = [];

  for (let i = 1; i <= 14; i++) {
    const id = `SEC-NET-${String(i).padStart(3, "0")}`;
    const titles = {
      1: "TLS minimums at edge",
      2: "HSTS",
      3: "CSP enforced",
      4: "CSP report-only",
      5: "COOP",
      6: "COEP",
      7: "CORP",
      8: "X-Content-Type-Options nosniff",
      9: "Referrer-Policy",
      10: "Permissions-Policy",
      11: "frame-ancestors / XFO",
      12: "CORS allowlists",
      13: "Cache-Control private on API",
      14: "Vary Cookie correctness",
    };
    out.push(
      row(id, titles[i], {
        I: i === 3 || i === 4 ? "src/lib/security/csp-builders.ts" : "",
        T: i === 3 ? "src/lib/security/csp-builders.test.ts" : "",
        E: "scripts/check-security-headers.mjs",
        priority: i <= 4 ? "P1" : "P2",
      })
    );
  }

  const authTitles = [
    "Supabase session SSR / proxy",
    "Cookie flags",
    "Session timeout policy",
    "Credential stuffing RL",
    "Enumeration parity",
    "Password reset flows",
    "MFA",
    "OAuth state PKCE",
    "API keys hash compare",
    "External evidence tokens",
    "Calendar feed tokens",
    "Cron shared secrets",
  ];
  for (let i = 0; i < authTitles.length; i++) {
    out.push(
      row(`SEC-AUTH-${String(i + 1).padStart(3, "0")}`, authTitles[i], {
        I: i === 0 ? "src/proxy.ts" : "",
        E: i === 11 ? "scripts/check-cron-route-auth.mjs" : E,
        priority: i < 6 ? "P0" : "P2",
      })
    );
  }

  const azTitles = [
    "Default deny",
    "Org membership on mutations",
    "Workspace mode gates",
    "Capability matrix",
    "IDOR contracts",
    "IDOR evidence",
    "IDOR approvals",
    "IDOR import export jobs",
    "IDOR external actions",
    "Admin bypass boundaries",
    "Mass assignment Zod strict",
  ];
  for (let i = 0; i < azTitles.length; i++) {
    out.push(row(`SEC-AZ-${String(i + 1).padStart(3, "0")}`, azTitles[i], { priority: "P0" }));
  }

  const inTitles = [
    "JSON schema bounds",
    "SQL parameterization",
    "CRLF redirects",
    "Log injection",
    "SMTP header injection",
    "ReDoS user regex",
    "Prototype pollution merges",
    "Command execution",
    "SSTI",
    "XXE XML bombs",
    "YAML unsafe load",
    "Msgpack protobuf boundaries",
  ];
  for (let i = 0; i < inTitles.length; i++) {
    out.push(row(`SEC-IN-${String(i + 1).padStart(3, "0")}`, inTitles[i], { priority: "P2" }));
  }

  const outTitles = ["React escaping", "JSON-LD serializer", "Markdown HTML sanitizer", "URL scheme allowlist", "SVG policy"];
  for (let i = 0; i < outTitles.length; i++) {
    out.push(
      row(`SEC-OUT-${String(i + 1).padStart(3, "0")}`, outTitles[i], {
        I: i === 1 ? "src/components/landing/landing-json-ld.tsx" : "",
        priority: "P2",
      })
    );
  }

  const bizTitles = [
    "Approval race",
    "Renewal race",
    "Evidence submit idempotency",
    "Payment webhook ordering",
    "Seat credit limits",
    "Integer money representation",
  ];
  for (let i = 0; i < bizTitles.length; i++) {
    out.push(row(`SEC-BIZ-${String(i + 1).padStart(3, "0")}`, bizTitles[i], { priority: "P0" }));
  }

  const dataTitles = [
    "RLS tenant tables",
    "SECURITY DEFINER inventory",
    "Views leakage",
    "Read models refresh authZ",
    "Signed URL TTL",
    "Object key prefix",
    "Backup restore",
    "Encryption at rest",
  ];
  for (let i = 0; i < dataTitles.length; i++) {
    out.push(row(`SEC-DATA-${String(i + 1).padStart(3, "0")}`, dataTitles[i], { priority: "P0" }));
  }
  out.push(
    row("SEC-DATA-FLE-001", "Field-level application encryption assessment", {
      priority: "P3",
      E,
      M: "out-of-repo: FLE assessment",
    })
  );

  const intTitles = [
    "Stripe webhook",
    "Stripe client misuse",
    "Webhooks dispatch HMAC",
    "OAuth callbacks",
    "Outbound safeFetch policy",
    "SSRF redirect chain",
    "Third-party script SRI",
    "Resend email",
    "OpenAI LLM",
  ];
  for (let i = 0; i < intTitles.length; i++) {
    out.push(
      row(`SEC-INT-${String(i + 1).padStart(3, "0")}`, intTitles[i], {
        T: i === 0 ? "src/lib/v10-route-api-catalog.v10.test.ts" : "",
        priority: "P0",
      })
    );
  }

  const dosTitles = [
    "Per-route rate limits",
    "Body size caps",
    "Pagination caps",
    "Expensive job concurrency",
    "Edge volumetric DDoS",
  ];
  for (let i = 0; i < dosTitles.length; i++) {
    out.push(
      row(`SEC-DOS-${String(i + 1).padStart(3, "0")}`, dosTitles[i], {
        E: "scripts/check-api-route-rate-limit-coverage.mjs",
        priority: "P0",
      })
    );
  }

  const logTitles = [
    "PII scrub logs",
    "Sentry scrub",
    "Audit table",
    "GDPR export",
    "GDPR erasure",
    "Retention cron",
    "Subprocessors doc",
  ];
  for (let i = 0; i < logTitles.length; i++) {
    out.push(row(`SEC-LOG-${String(i + 1).padStart(3, "0")}`, logTitles[i], { priority: "P3" }));
  }

  const sdlcTitles = [
    "Disclosure policy out of repo",
    "Optional RFC 9116 security.txt at edge",
    "CODEOWNERS",
    "Semgrep pack",
    "CodeQL optional",
    "GH Actions SHA pins",
    "npm audit CI",
    "SBOM release",
    "License scan",
    "Threat modeling out of repo",
    "IR runbooks out of repo",
    "Honeytokens optional",
  ];
  for (let i = 0; i < sdlcTitles.length; i++) {
    out.push(row(`SEC-SDLC-${String(i + 1).padStart(3, "0")}`, sdlcTitles[i], { priority: "SDLC" }));
  }
  out.push(
    row("SEC-SDLC-BT-001", "Binary transparency Sigstore provenance", {
      priority: "SDLC",
      M: "out-of-repo: Sigstore/cosign program",
    })
  );

  const stdTitles = [
    "OWASP Web Top 10 map",
    "OWASP API Top 10 map",
    "ASVS V1-V14 map",
    "PCI DSS map",
    "SOC2 map",
    "SLSA map",
    "NIST SSDF map",
    "CAPEC CWE notes",
    "MITRE ATTACK crosswalk",
    "NIST CSF 2.0 crosswalk",
    "ISO 27001 themes",
    "OWASP SAMM Proactive Controls",
    "CWE Top 25 mapping",
    "MASVS PWA subset",
    "HIPAA FedRAMP placeholders",
    "ENISA NIS2 DORA notes",
    "NCSC CAF CIS pointers",
    "Zero Trust map",
    "Regional sectoral privacy index",
    "WebAuthn JWT JWKS summary",
    "OWASP LLM Top 10 Appendix D",
    "COBIT ITIL lite",
    "NIST SP 800-53 Rev5 lite",
    "ISO 27701 22301 extensions",
    "APRA PCI SSF pointers",
    "Supplementary frameworks index",
  ];
  for (let i = 0; i < stdTitles.length; i++) {
    out.push(
      row(`SEC-STD-${String(i + 1).padStart(3, "0")}`, stdTitles[i], {
        I: "",
        priority: "SDLC",
      })
    );
  }

  const manTitles = [
    "WAF",
    "IAM cloud",
    "DMARC",
    "Pen test cadence",
    "Bug bounty",
    "Physical security",
    "Cyber insurance",
    "CT log monitoring",
    "KMS HSM",
    "mTLS internal mesh",
    "SIEM",
    "Vendor SOC2 review",
    "DPA signatures",
    "CAA DNS",
    "Subdomain takeover process",
    "Branch protection merge policy",
    "MDM endpoint compliance",
    "Vendor SOC2 storage review",
    "DDoS volumetric playbooks",
    "IR retainer counsel",
    "Security awareness training",
    "Tabletop exercises",
    "Key ceremony HSM break-glass",
    "Data residency legal review",
    "Cross-border SCCs DPF",
  ];
  for (let i = 0; i < manTitles.length; i++) {
    out.push(
      row(`SEC-MAN-${String(i + 1).padStart(3, "0")}`, manTitles[i], {
        I_refs: "",
        T_refs: "",
        E_refs: "",
        M_refs: `out-of-repo: SEC-MAN-${String(i + 1).padStart(3, "0")} org evidence`,
        priority: "SDLC",
      })
    );
  }

  const nist53 = ["AC", "AU", "AT", "CA", "CM", "CP", "IA", "IR", "MA", "MP", "PE", "PL", "PM", "PS", "RA", "SA", "SC", "SI", "SR"];
  for (const fam of nist53) {
    out.push(
      row(`SEC-NIST53-${fam}`, `NIST 800-53 family ${fam}`, {
        E,
        priority: "SDLC",
      })
    );
  }

  const llmTitles = [
    "LLM01 prompt injection",
    "LLM02 insecure output",
    "LLM03 training data poisoning",
    "LLM04 model DoS",
    "LLM05 supply chain models",
    "LLM06 sensitive disclosure",
    "LLM07 insecure plugin design",
    "LLM08 excessive agency",
    "LLM09 overreliance",
    "LLM10 model theft",
  ];
  for (let i = 0; i < llmTitles.length; i++) {
    out.push(
      naRow(`SEC-LLM-${String(i + 1).padStart(3, "0")}`, llmTitles[i], "No in-product LLM surface in default build; revalidate if OpenAI paths enabled.")
    );
  }

  for (let i = 1; i <= 10; i++) {
    const titles = {
      1: "ETag leak prevention",
      2: "Range request abuse",
      3: "Content-Type sniffing",
      4: "Path normalization",
      5: "Duplicate Cookie Authorization",
      6: "Early Hints 103",
      7: "Compression BREACH class",
      8: "RFC 7807 Problem Details",
      9: "RFC 9441 RateLimit headers",
      10: "RFC 8725 JWT BCP",
    };
    out.push(row(`SEC-HTTP-${String(i).padStart(3, "0")}`, titles[i], { priority: i <= 7 ? "P2" : "P3" }));
  }

  const runTitles = [
    "NODE_OPTIONS inspect ban prod",
    "Global error handlers hygiene",
    "Source maps private",
    "JSON bigint precision",
  ];
  for (let i = 0; i < runTitles.length; i++) {
    out.push(row(`SEC-RUN-${String(i + 1).padStart(3, "0")}`, runTitles[i], { priority: "P3" }));
  }

  const ciTitles = [
    "Fork PR secret exposure policy",
    "Provenance attestations",
    "Trivy fs optional scan",
    "Artifact signing",
  ];
  for (let i = 0; i < ciTitles.length; i++) {
    out.push(row(`SEC-CI-${String(i + 1).padStart(3, "0")}`, ciTitles[i], { priority: "SDLC" }));
  }

  const cronTitles = [
    "Cron inventory vs vercel.json",
    "GH scheduled workflows",
    "External pingers doc",
    "Job blast radius DLQ",
  ];
  for (let i = 0; i < cronTitles.length; i++) {
    out.push(row(`SEC-CRON-${String(i + 1).padStart(3, "0")}`, cronTitles[i], { priority: "P0" }));
  }

  out.push(row("SEC-FF-001", "Server-evaluated feature flags for risky modules", { priority: "P3" }));
  out.push(row("SEC-FF-002", "Client-only flags cannot gate authZ", { priority: "P0" }));

  const ztaTitles = [
    "ZTA identity plane",
    "ZTA device plane",
    "ZTA session plane",
    "ZTA data plane",
    "ZTA application plane",
    "ZTA network plane",
    "ZTA continuous verification",
    "ZTA governance engine",
  ];
  for (let i = 0; i < ztaTitles.length; i++) {
    out.push(row(`SEC-ZTA-${String(i + 1).padStart(3, "0")}`, ztaTitles[i], { priority: "P3" }));
  }

  const opsTitles = [
    "Red team attack simulation",
    "Purple team exercises",
    "Bug bounty program scope",
    "Threat intelligence IOC STIX",
    "Incident severity model",
  ];
  for (let i = 0; i < opsTitles.length; i++) {
    out.push(row(`SEC-OPS-${String(i + 1).padStart(3, "0")}`, opsTitles[i], { priority: "SDLC" }));
  }

  const ttTitles = [
    "Trusted Types default policy",
    "Trusted Types report-only burn-in",
    "Trusted Types enforcement toggle",
    "Trusted Types DOM sink inventory",
  ];
  for (let i = 0; i < ttTitles.length; i++) {
    out.push(row(`SEC-TT-${String(i + 1).padStart(3, "0")}`, ttTitles[i], { priority: "P1" }));
  }

  out.push(
    row("SEC-PRIV-REG-INDEX", "Regional privacy index parent", {
      M: "out-of-repo: regional privacy register",
      priority: "P3",
    })
  );

  const jurisdictions = [
    "GDPR EU",
    "UK GDPR",
    "Swiss FADP",
    "EU ePrivacy marketing cookies",
    "Brazil LGPD",
    "Canada PIPEDA",
    "Quebec Law 25",
    "Japan APPI",
    "South Korea PIPA",
    "Singapore PDPA",
    "Australia Privacy Act",
    "India DPDPA",
    "China PIPL",
    "Saudi PDPL",
    "UAE PDPL",
    "South Africa POPIA",
    "Israel privacy",
    "Turkey KVKK",
    "Thailand PDPA",
    "Taiwan PDPA",
    "Malaysia PDPA",
    "New Zealand Privacy Act",
    "US sectoral HIPAA pointer",
    "US state privacy patchwork",
    "Indonesia PDP",
    "Vietnam PDP",
    "Philippines DPA",
    "Argentina PDPA",
    "Chile PDPA",
    "Colombia PDPA",
    "Mexico LFPDPPP",
    "Norway GDPR EEA",
    "Iceland GDPR EEA",
    "Liechtenstein GDPR EEA",
    "Russia FZ-152",
    "Ukraine PDPL",
    "Egypt PDPL",
    "Nigeria NDPR",
    "Kenya DPA",
    "Ghana DPA",
    "Peru PDPA",
    "Uruguay PDPA",
  ];
  for (let i = 0; i < 40; i++) {
    out.push(
      row(
        `SEC-PRIV-REG-${String(i + 1).padStart(3, "0")}`,
        jurisdictions[i] ?? `Jurisdiction placeholder ${i + 1}`,
        { M: "out-of-repo: regional privacy register", priority: "P3" }
      )
    );
  }

  out.push(
    row("SEC-PRIV-PIA-001", "PIA DPIA program parent", {
      M: "out-of-repo: PIA/DPIA program",
      priority: "P3",
    })
  );

  const naIds = [
    ["SEC-COMP-N/A-HIPAA", "HIPAA not applicable"],
    ["SEC-COMP-N/A-FEDRAMP", "FedRAMP not applicable"],
    ["SEC-COMP-N/A-OT", "OT SCADA not applicable"],
    ["SEC-COMP-N/A-KERNEL", "Kernel escape N/A serverless"],
    ["SEC-COMP-N/A-TEE", "TEE confidential computing N/A"],
    ["SEC-COMP-N/A-GRPC", "gRPC not in product"],
    ["SEC-COMP-N/A-KERB", "Kerberos not in product"],
    ["SEC-COMP-N/A-JWT", "First-party JWT JWKS N/A Supabase session"],
    ["SEC-COMP-N/A-APRA", "APRA CPS234 N/A"],
    ["SEC-COMP-N/A-SSF", "PCI SSF N/A"],
    ["SEC-COMP-N/A-FIPS140", "FIPS140 module N/A default"],
    ["SEC-COMP-N/A-IEC62443", "IEC62443 N/A"],
    ["SEC-COMP-N/A-WT", "WebTransport N/A"],
    ["SEC-COMP-N/A-CMMC", "CMMC N/A"],
    ["SEC-COMP-N/A-SWIFT", "SWIFT CSP N/A"],
    ["SEC-COMP-N/A-SOX", "SOX ITGC N/A private issuer scope"],
    ["SEC-COMP-N/A-GLBA", "GLBA N/A"],
  ];
  for (const [id, t] of naIds) {
    out.push(naRow(id, t, "Out of product scope or delegated to platform; annual review.", M));
  }

  for (let i = 1; i <= 10; i++) {
    out.push(
      row(`SEC-API${i}`, `OWASP API Top 10 anchor API${i}`, {
        E: "scripts/check-api-route-auth-contract.mjs",
        priority: "P0",
      })
    );
  }

  out.push(
    row("SEC-AUTO-PROG-001", "Autonomous security program aggregated inventory checks", {
      I: "scripts/lib/security-program-checks.mjs",
      T: "src/lib/security/autonomous-security-program.test.ts src/lib/security/security-plan-todo-coverage.test.ts",
      E: "scripts/check-autonomous-security-program.mjs",
      priority: "P0",
    })
  );

  return out;
}
