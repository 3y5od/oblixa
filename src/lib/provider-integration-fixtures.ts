export type ProviderIntegrationFamily = "stripe" | "email" | "openai" | "redis" | "oauth_token";

export type ProviderIntegrationFixture = {
  id: string;
  family: ProviderIntegrationFamily;
  scenario: string;
  expectedOutcome: "accepted" | "blocked" | "degraded" | "retryable" | "audited";
  tenantScoped: boolean;
  replaySafe: boolean;
  sanitizedDiagnostics: boolean;
};

export const REQUIRED_PROVIDER_INTEGRATION_SCENARIOS: Record<ProviderIntegrationFamily, string[]> = {
  stripe: [
    "checkout_completed",
    "portal_return",
    "webhook_replay",
    "subscription_downgrade",
    "failed_payment",
    "trial_expiry",
    "customer_mismatch",
    "test_live_mismatch",
  ],
  email: [
    "spf_dkim_dmarc_dns",
    "bounce_handling",
    "unsubscribe_headers",
    "template_escaping",
    "rate_limit",
    "suppression_list",
    "provider_outage",
  ],
  openai: [
    "api_key_absent",
    "quota_error",
    "invalid_model",
    "timeout",
    "retry",
    "partial_output",
    "hallucinated_citation",
    "raw_prompt_leakage",
    "provider_failover",
  ],
  redis: [
    "upstash_success",
    "upstash_outage",
    "timeout",
    "malformed_response",
    "clock_skew",
    "eviction_or_fallback",
    "key_prefix_collision",
    "pii_key_sanitization",
  ],
  oauth_token: [
    "state_integrity",
    "pkce_s256",
    "token_encryption",
    "key_versioning",
    "refresh_failure",
    "revocation",
    "reencryption_tooling",
  ],
};

export const PROVIDER_INTEGRATION_FIXTURES: ProviderIntegrationFixture[] = [
  { id: "stripe-checkout-completed", family: "stripe", scenario: "checkout_completed", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-portal-return", family: "stripe", scenario: "portal_return", expectedOutcome: "accepted", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-webhook-replay", family: "stripe", scenario: "webhook_replay", expectedOutcome: "accepted", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-subscription-downgrade", family: "stripe", scenario: "subscription_downgrade", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-failed-payment", family: "stripe", scenario: "failed_payment", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-trial-expiry", family: "stripe", scenario: "trial_expiry", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-customer-mismatch", family: "stripe", scenario: "customer_mismatch", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "stripe-test-live-mismatch", family: "stripe", scenario: "test_live_mismatch", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },

  { id: "email-auth-dns", family: "email", scenario: "spf_dkim_dmarc_dns", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-bounce-handling", family: "email", scenario: "bounce_handling", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-unsubscribe-headers", family: "email", scenario: "unsubscribe_headers", expectedOutcome: "accepted", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-template-escaping", family: "email", scenario: "template_escaping", expectedOutcome: "accepted", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-rate-limit", family: "email", scenario: "rate_limit", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-suppression-list", family: "email", scenario: "suppression_list", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "email-provider-outage", family: "email", scenario: "provider_outage", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },

  { id: "openai-api-key-absent", family: "openai", scenario: "api_key_absent", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-quota-error", family: "openai", scenario: "quota_error", expectedOutcome: "retryable", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-invalid-model", family: "openai", scenario: "invalid_model", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-timeout", family: "openai", scenario: "timeout", expectedOutcome: "retryable", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-retry", family: "openai", scenario: "retry", expectedOutcome: "retryable", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-partial-output", family: "openai", scenario: "partial_output", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-hallucinated-citation", family: "openai", scenario: "hallucinated_citation", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-raw-prompt-leakage", family: "openai", scenario: "raw_prompt_leakage", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "openai-provider-failover", family: "openai", scenario: "provider_failover", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },

  { id: "redis-upstash-success", family: "redis", scenario: "upstash_success", expectedOutcome: "accepted", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-upstash-outage", family: "redis", scenario: "upstash_outage", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-timeout", family: "redis", scenario: "timeout", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-malformed-response", family: "redis", scenario: "malformed_response", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-clock-skew", family: "redis", scenario: "clock_skew", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-eviction-fallback", family: "redis", scenario: "eviction_or_fallback", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-key-prefix-collision", family: "redis", scenario: "key_prefix_collision", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "redis-pii-key-sanitization", family: "redis", scenario: "pii_key_sanitization", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },

  { id: "oauth-state-integrity", family: "oauth_token", scenario: "state_integrity", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-pkce-s256", family: "oauth_token", scenario: "pkce_s256", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-token-encryption", family: "oauth_token", scenario: "token_encryption", expectedOutcome: "blocked", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-key-versioning", family: "oauth_token", scenario: "key_versioning", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-refresh-failure", family: "oauth_token", scenario: "refresh_failure", expectedOutcome: "degraded", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-revocation", family: "oauth_token", scenario: "revocation", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
  { id: "oauth-reencryption-tooling", family: "oauth_token", scenario: "reencryption_tooling", expectedOutcome: "audited", tenantScoped: true, replaySafe: true, sanitizedDiagnostics: true },
];

export function providerIntegrationFixtureIssues(
  fixtures: ProviderIntegrationFixture[] = PROVIDER_INTEGRATION_FIXTURES
): string[] {
  const issues: string[] = [];
  const byFamily = new Map<ProviderIntegrationFamily, Set<string>>();
  for (const fixture of fixtures) {
    const scenarios = byFamily.get(fixture.family) ?? new Set<string>();
    scenarios.add(fixture.scenario);
    byFamily.set(fixture.family, scenarios);
    if (!fixture.tenantScoped) issues.push(`${fixture.id}:tenant_scope_required`);
    if (!fixture.replaySafe) issues.push(`${fixture.id}:replay_safety_required`);
    if (!fixture.sanitizedDiagnostics) issues.push(`${fixture.id}:sanitized_diagnostics_required`);
  }
  for (const [family, scenarios] of Object.entries(REQUIRED_PROVIDER_INTEGRATION_SCENARIOS) as Array<[ProviderIntegrationFamily, string[]]>) {
    const present = byFamily.get(family) ?? new Set<string>();
    for (const scenario of scenarios) {
      if (!present.has(scenario)) issues.push(`${family}:${scenario}:missing`);
    }
  }
  return issues.sort();
}
