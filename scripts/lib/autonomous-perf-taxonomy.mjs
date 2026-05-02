/**
 * Maps each EXT key to a taxonomy_group_slug for autonomous-perf-ext-key-groups.json.
 * Slugs align with plan headings (cloud_edge, data_platform, ci_runner, …).
 */
const PREFIX_TO_GROUP = new Map(
  Object.entries({
    a11y: "a11y_program",
    ai: "ai_governance",
    backup: "data_platform",
    biz: "org_economics",
    build: "supply_chain",
    cache: "client_delivery",
    carbon: "sustainability",
    cdn: "cloud_edge",
    ci: "ci_runner",
    compliance: "compliance_ops",
    compute: "compute_runtime",
    container: "compute_runtime",
    crypto: "security_crypto",
    data: "data_platform",
    db: "data_platform",
    dns: "cloud_edge",
    email: "email_identity",
    finreg: "finreg",
    fraud: "fraud_abuse",
    geo: "cloud_edge",
    hw: "hw_os",
    i18n: "i18n_vendor",
    idp: "identity_sso",
    k8s: "k8s",
    legal: "legal_discovery",
    lb: "cloud_edge",
    ml: "ml_governance",
    mobile: "mobile_surface",
    npm: "supply_chain",
    o11y: "observability_vendor",
    ops: "operations",
    os: "hw_os",
    otel: "observability_vendor",
    payments: "payments_network",
    qa: "qa_device_lab",
    reg: "regulatory_calendar",
    runtime: "compute_runtime",
    scm: "scm_repository",
    sec: "security_ops",
    secrets: "secrets_management",
    serverless: "compute_runtime",
    service_mesh: "networking_internal",
    tls: "cloud_edge",
    vendor: "third_party_vendor",
    wasm: "supply_chain",
    vpc: "networking_internal",
    waf: "cloud_edge",
  }),
);

export function taxonomyGroupForExtKey(key) {
  const dot = key.indexOf(".");
  const prefix = dot === -1 ? key : key.slice(0, dot);
  return PREFIX_TO_GROUP.get(prefix) ?? "external_general";
}
