export type WebhookCallbackFixtureKind =
  | "success"
  | "duplicate_delivery"
  | "bad_signature"
  | "stale_timestamp"
  | "unknown_event"
  | "malformed_payload"
  | "wrong_content_type"
  | "wrong_mode"
  | "retry"
  | "provider_outage"
  | "open_redirect"
  | "private_network_url"
  | "custom_scheme";

export type WebhookCallbackFixture = {
  id: string;
  family: "stripe_webhook" | "slack_inbound" | "email_inbound" | "outbound_webhook_dispatch" | "oauth_callback" | "auth_callback";
  kind: WebhookCallbackFixtureKind;
  route: string;
  expectedStatus: number;
  replaySafe: boolean;
  signed: boolean;
  description: string;
  body?: string;
  headers?: Record<string, string>;
};

export const WEBHOOK_CALLBACK_FIXTURES: WebhookCallbackFixture[] = [
  {
    id: "stripe-success",
    family: "stripe_webhook",
    kind: "success",
    route: "/api/stripe/webhook",
    expectedStatus: 200,
    replaySafe: true,
    signed: true,
    description: "Valid Stripe event is accepted and durably claimed before side effects.",
    body: "{\"id\":\"evt_fixture_success\",\"type\":\"invoice.payment_failed\"}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-duplicate-delivery",
    family: "stripe_webhook",
    kind: "duplicate_delivery",
    route: "/api/stripe/webhook",
    expectedStatus: 200,
    replaySafe: true,
    signed: true,
    description: "Duplicate Stripe event id returns a duplicate acknowledgement without side effects.",
    body: "{\"id\":\"evt_fixture_duplicate\",\"type\":\"invoice.payment_failed\"}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-bad-signature",
    family: "stripe_webhook",
    kind: "bad_signature",
    route: "/api/stripe/webhook",
    expectedStatus: 400,
    replaySafe: true,
    signed: false,
    description: "Invalid Stripe signature is rejected before event claim.",
    body: "{\"id\":\"evt_fixture_bad_sig\"}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=bad" },
  },
  {
    id: "stripe-stale-timestamp",
    family: "stripe_webhook",
    kind: "stale_timestamp",
    route: "/api/stripe/webhook",
    expectedStatus: 400,
    replaySafe: true,
    signed: false,
    description: "Stale Stripe timestamp is rejected by the provider signature verifier tolerance.",
    body: "{\"id\":\"evt_fixture_stale\"}",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=fixture" },
  },
  {
    id: "stripe-unknown-event",
    family: "stripe_webhook",
    kind: "unknown_event",
    route: "/api/stripe/webhook",
    expectedStatus: 200,
    replaySafe: true,
    signed: true,
    description: "Unknown Stripe event family is claimed and completed without customer mutation.",
    body: "{\"id\":\"evt_fixture_unknown\",\"type\":\"customer.tax_id.created\"}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-malformed-payload",
    family: "stripe_webhook",
    kind: "malformed_payload",
    route: "/api/stripe/webhook",
    expectedStatus: 400,
    replaySafe: true,
    signed: false,
    description: "Malformed Stripe payload is rejected by provider verification before event claim.",
    body: "{",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-wrong-content-type",
    family: "stripe_webhook",
    kind: "wrong_content_type",
    route: "/api/stripe/webhook",
    expectedStatus: 415,
    replaySafe: true,
    signed: false,
    description: "Non-JSON Stripe webhook content type is rejected before body parsing.",
    body: "{}",
    headers: { "content-type": "text/plain", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-wrong-mode",
    family: "stripe_webhook",
    kind: "wrong_mode",
    route: "/api/stripe/webhook",
    expectedStatus: 400,
    replaySafe: true,
    signed: true,
    description: "Signed Stripe webhook events are rejected when livemode mismatches configured test/live mode.",
    body: "{\"id\":\"evt_fixture_wrong_mode\",\"type\":\"invoice.payment_failed\",\"livemode\":true}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "stripe-provider-outage",
    family: "stripe_webhook",
    kind: "provider_outage",
    route: "/api/stripe/webhook",
    expectedStatus: 503,
    replaySafe: true,
    signed: false,
    description: "Stripe provider misconfiguration returns dependency_blocked without event claim.",
    body: "{}",
    headers: { "content-type": "application/json", "stripe-signature": "t=fixture,v1=fixture" },
  },
  {
    id: "outbound-webhook-retry",
    family: "outbound_webhook_dispatch",
    kind: "retry",
    route: "/api/webhooks/dispatch",
    expectedStatus: 200,
    replaySafe: true,
    signed: true,
    description: "Failed outbound delivery records retry metadata and leaves the event pending.",
  },
  {
    id: "outbound-webhook-provider-outage",
    family: "outbound_webhook_dispatch",
    kind: "provider_outage",
    route: "/api/webhooks/dispatch",
    expectedStatus: 200,
    replaySafe: true,
    signed: true,
    description: "Network failure is counted as a bounded delivery failure with backoff.",
  },
  {
    id: "oauth-open-redirect",
    family: "oauth_callback",
    kind: "open_redirect",
    route: "/api/integrations/oauth/callback",
    expectedStatus: 400,
    replaySafe: true,
    signed: false,
    description: "OAuth redirect URI must resolve to the exact same-origin callback route.",
  },
  {
    id: "oauth-private-network",
    family: "oauth_callback",
    kind: "private_network_url",
    route: "/api/integrations/oauth/callback",
    expectedStatus: 400,
    replaySafe: true,
    signed: false,
    description: "OAuth callback rejects private-network redirect targets through same-origin path checks.",
  },
  {
    id: "auth-custom-scheme",
    family: "auth_callback",
    kind: "custom_scheme",
    route: "/auth/callback",
    expectedStatus: 302,
    replaySafe: true,
    signed: false,
    description: "Auth callback next parameter is normalized to a safe path, not a custom scheme.",
  },
];
