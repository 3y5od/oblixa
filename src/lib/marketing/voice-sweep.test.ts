import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app/(marketing)", "src/components/landing", "src/components/auth"] as const;

const FORBIDDEN_PUBLIC_COPY = [
  "Start free trial",
  "21-day free trial",
  "Book setup call",
  "Try Oblixa free",
  "Create free account",
  "$299",
  "Founding Customer",
  "Guided Pilot",
  "Assurance workflows",
  "Reach the security team",
  "Maintained by security team",
  "Acknowledged within 1 business day",
] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (/\.(tsx?|mdx?)$/u.test(entry)) out.push(path);
  }
  return out;
}

function read(relPath: string) {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

describe("public marketing release-state voice sweep", () => {
  it("keeps public surfaces in reviewed-access posture", () => {
    const cwd = process.cwd();
    const files = [
      ...ROOTS.flatMap((root) => walk(join(cwd, root))),
      join(cwd, "src/app/page.tsx"),
      join(cwd, "src/app/opengraph-image.tsx"),
      join(cwd, "src/app/twitter-image.tsx"),
    ];
    const violations: Array<{ file: string; phrase: string }> = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const phrase of FORBIDDEN_PUBLIC_COPY) {
        if (source.includes(phrase)) {
          violations.push({ file: relative(cwd, file), phrase });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("pins the homepage promise and request-access CTA", () => {
    const content = read("src/components/landing/landing-content.ts");
    const page = read("src/components/landing/landing-page.tsx");

    expect(content).toContain('heroTitle = "Track what signed contracts require next."');
    expect(content).toContain("Request access");
    expect(page).toContain('href="/request-access"');
    expect(page).toContain("<ProblemSection />");
    expect(page).toContain("<BestFitSection />");
    expect(page).toContain("<PricingCtaSection />");
  });

  it("pins the request-access flow and fit-based confirmation copy", () => {
    const route = read("src/app/(marketing)/request-access/page.tsx");
    const form = read("src/components/landing/contact-form.tsx");
    const api = read("src/app/api/contact/route.ts");

    expect(route).toContain("Reviewed workspace access");
    expect(route).toContain("Redacted sample");
    expect(form).toContain("trackingMethod");
    expect(form).toContain("redactedSample");
    expect(form).toContain("preference");
    expect(form).toContain("If there is a fit");
    expect(api).toContain('"request_access"');
    expect(api).toContain("invalid_tracking_method");
    expect(api).not.toContain("assurance_workflows");
  });

  it("pins modest security and contact pages", () => {
    const security = read("src/app/(marketing)/security/page.tsx");
    const contact = read("src/app/(marketing)/contact/page.tsx");

    expect(security).toContain("reviewed access");
    expect(security).toContain("does not provide legal advice");
    expect(security).toContain("formal enterprise security review");
    expect(contact).toContain("Contact Oblixa");
    expect(contact).toContain("Request workspace access");
    expect(contact).toContain("Security and vulnerability reports");
    expect(contact).toContain("Existing workspace or billing issue");
    expect(contact).not.toContain("ContactForm");
    expect(contact).not.toContain("1-day reply");
  });
});
