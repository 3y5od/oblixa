import { describe, expect, it } from "vitest";
import {
  buildEdgeReadinessFixtureReport,
  classifyEdgeCachePolicy,
  evaluateDnsReadiness,
  evaluateEmailAuthReadiness,
  evaluateTlsReadiness,
  redactDnsValue,
} from "@/lib/operational-edge-readiness";

describe("operational edge DNS readiness", () => {
  it("classifies missing required records and redacts verification-like TXT values", () => {
    const report = evaluateDnsReadiness(
      [
        { host: "oblixa.io", type: "A", required: true },
        { host: "oblixa.io", type: "CAA", required: true },
        { host: "www.oblixa.io", type: "CNAME", required: false },
      ],
      [{ host: "oblixa.io", type: "TXT", values: ["google-site-verification=very-secret-token"] }],
    );
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      { issue: "dns_record_missing", target: "oblixa.io:A", detail: "provider_manual_boundary" },
      { issue: "dns_record_missing", target: "oblixa.io:CAA", detail: "provider_manual_boundary" },
    ]);
    expect(JSON.stringify(report.redactedObservations)).not.toContain("very-secret-token");
  });

  it("keeps public SPF and DMARC values inspectable while redacting long key material", () => {
    expect(redactDnsValue("v=spf1 include:_spf.resend.com -all")).toBe("v=spf1 include:_spf.resend.com -all");
    expect(redactDnsValue("google-site-verification=abcdef1234567890")).toMatch(/^\[redacted-dns-token:/u);
    expect(redactDnsValue(`v=DKIM1; k=rsa; p=${"a".repeat(96)}`)).toContain("p=<redacted>");
  });
});

describe("operational edge TLS readiness", () => {
  it("accepts a current certificate with issuer, SAN, modern protocol, redirect, HSTS, and no mixed content", () => {
    expect(
      evaluateTlsReadiness(
        {
          host: "app.oblixa.io",
          validTo: "2026-08-01T00:00:00.000Z",
          issuer: "Example CA",
          subjectAltNames: ["app.oblixa.io", "*.oblixa.io"],
          protocol: "TLSv1.3",
          redirectsToHttps: true,
          hstsHeader: "max-age=31536000; includeSubDomains; preload",
          mixedContentUrls: [],
        },
        { now: "2026-05-28T00:00:00.000Z" },
      ).ok,
    ).toBe(true);
  });

  it("rejects expiring, weak, unredirected, or mixed-content TLS observations", () => {
    const report = evaluateTlsReadiness(
      {
        host: "app.oblixa.io",
        validTo: "2026-06-01T00:00:00.000Z",
        issuer: null,
        subjectAltNames: ["other.example.com"],
        protocol: "TLSv1.1",
        redirectsToHttps: false,
        hstsHeader: null,
        mixedContentUrls: ["http://cdn.example.test/file.js"],
      },
      { now: "2026-05-28T00:00:00.000Z" },
    );
    expect(report.issues.map((issue) => issue.issue)).toEqual(
      expect.arrayContaining([
        "tls_certificate_expiring",
        "tls_issuer_missing",
        "tls_san_missing_host",
        "tls_protocol_below_minimum",
        "edge_http_redirect_missing",
        "edge_hsts_missing",
        "edge_mixed_content_risk",
      ]),
    );
  });
});

describe("operational edge email auth and cache readiness", () => {
  it("requires enforcing SPF, DKIM, DMARC, MX/MTA-STS, and aligned mail domains", () => {
    expect(
      evaluateEmailAuthReadiness({
        domain: "oblixa.io",
        spf: "v=spf1 include:_spf.resend.com -all",
        dkim: ["v=DKIM1; k=rsa; p=<provider-managed>"],
        dmarc: "v=DMARC1; p=quarantine; rua=mailto:dmarc@oblixa.io",
        mx: ["10 feedback-smtp.example.test"],
        mtaSts: "v=STSv1; id=20260528",
        sendingDomain: "mail.oblixa.io",
        bounceDomain: "bounce.oblixa.io",
        replyToDomain: "support.oblixa.io",
        environmentDomain: "oblixa.io",
      }).ok,
    ).toBe(true);
  });

  it("flags weak email auth and cross-environment domain mixing", () => {
    const report = evaluateEmailAuthReadiness({
      domain: "oblixa.io",
      spf: "v=spf1 include:_spf.example.com ?all",
      dkim: [],
      dmarc: "v=DMARC1; p=none",
      mx: [],
      mtaSts: null,
      sendingDomain: "staging.oblixa.io",
      bounceDomain: "bounce.other.test",
      replyToDomain: "reply.other.test",
      environmentDomain: "oblixa.io",
    });
    expect(report.issues.map((issue) => issue.issue)).toEqual(
      expect.arrayContaining([
        "email_spf_not_enforcing",
        "email_dkim_missing",
        "email_dmarc_not_enforcing",
        "email_mx_unclassified",
        "email_mta_sts_missing",
        "email_bounce_domain_misaligned",
        "email_reply_to_domain_misaligned",
        "email_environment_domain_mixed",
      ]),
    );
  });

  it("classifies public and private edge cache policies", () => {
    expect(
      classifyEdgeCachePolicy({
        path: "/pricing",
        headers: { "cache-control": "public, max-age=300, stale-while-revalidate=86400", vary: "Accept-Encoding" },
      }),
    ).toMatchObject({ ok: true, cacheClass: "public-cacheable" });
    expect(
      classifyEdgeCachePolicy({
        path: "/api/contracts",
        headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization", "surrogate-control": "no-store" },
      }),
    ).toMatchObject({ ok: true, cacheClass: "private-no-store" });
    expect(
      classifyEdgeCachePolicy({
        path: "/settings/security",
        headers: { "cache-control": "public, max-age=600" },
      }).issues.map((issue) => issue.issue),
    ).toEqual(expect.arrayContaining(["edge_private_cache_missing_no_store", "edge_private_vary_missing"]));
  });

  it("builds a complete fixture report across DNS, TLS, email, and cache observations", () => {
    const report = buildEdgeReadinessFixtureReport({
      now: "2026-05-28T00:00:00.000Z",
      dnsExpectations: [{ host: "oblixa.io", type: "A", required: true }],
      dnsObservations: [{ host: "oblixa.io", type: "A", values: ["203.0.113.10"] }],
      tlsObservations: [
        {
          host: "oblixa.io",
          validTo: "2026-08-01T00:00:00.000Z",
          issuer: "Example CA",
          subjectAltNames: ["oblixa.io"],
          protocol: "TLSv1.3",
          redirectsToHttps: true,
          hstsHeader: "max-age=31536000",
          mixedContentUrls: [],
        },
      ],
      emailObservations: [
        {
          domain: "oblixa.io",
          spf: "v=spf1 include:_spf.resend.com -all",
          dkim: ["v=DKIM1; k=rsa; p=<provider-managed>"],
          dmarc: "v=DMARC1; p=reject",
          mx: ["10 mx.example.test"],
          mtaSts: "v=STSv1; id=20260528",
          sendingDomain: "mail.oblixa.io",
          bounceDomain: "bounce.oblixa.io",
          replyToDomain: "support.oblixa.io",
          environmentDomain: "oblixa.io",
        },
      ],
      cacheInputs: [{ path: "/api/health", headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization", "surrogate-control": "no-store" } }],
    });
    expect(report.ok).toBe(true);
  });
});
