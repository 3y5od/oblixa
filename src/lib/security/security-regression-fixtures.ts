import {
  BODY_LIMIT_LARGE_JSON,
  BODY_LIMIT_MEDIUM_JSON,
  BODY_LIMIT_SMALL_JSON,
} from "@/lib/security/read-json-body-limited";

export const SECURITY_REGRESSION_FIXTURES = {
  xssStrings: [
    '<img src=x onerror=alert("xss")>',
    '<svg><script>alert("xss")</script></svg>',
    'javascript:alert("xss")',
  ],
  sqlLikePayloads: [
    "' OR 1=1 --",
    "admin'; DROP TABLE contracts; --",
    "1 UNION SELECT password FROM profiles",
  ],
  csvFormulas: [
    '=HYPERLINK("https://evil.test","open")',
    "+SUM(1,1)",
    "-2+3",
    "@cmd",
    "\t=IMPORTXML(\"https://evil.test\")",
  ],
  bidiStrings: [
    "invoice\u202egnp.exe",
    "safe\u2066hidden\u2069text",
  ],
  ssrfUrls: [
    "http://127.0.0.1/admin",
    "http://[::1]/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://example.com@127.0.0.1/private",
  ],
  badTokens: [
    "",
    "short",
    "../etc/passwd",
    "token\r\nx-bad: injected",
    "a".repeat(4096),
  ],
  badOrigins: [
    "null",
    "https://evil.test",
    "http://localhost.evil.test",
    "https://oblixa.test.evil.test",
  ],
  oversizedBodies: [
    { name: "small_json_limit_plus_one", bytes: BODY_LIMIT_SMALL_JSON + 1 },
    { name: "medium_json_limit_plus_one", bytes: BODY_LIMIT_MEDIUM_JSON + 1 },
    { name: "large_json_limit_plus_one", bytes: BODY_LIMIT_LARGE_JSON + 1 },
  ],
} as const;

export type SecurityRegressionFixtureKind = keyof typeof SECURITY_REGRESSION_FIXTURES;

export function getSecurityRegressionFixtures<K extends SecurityRegressionFixtureKind>(
  kind: K
): (typeof SECURITY_REGRESSION_FIXTURES)[K] {
  return SECURITY_REGRESSION_FIXTURES[kind];
}
