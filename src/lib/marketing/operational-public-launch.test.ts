import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_CONVERSION_FLOW_IDS,
  OPERATIONAL_MARKETING_ASSET_METADATA_IDS,
  OPERATIONAL_PRIVATE_SURFACE_IDS,
  OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS,
  evaluatePublicLaunchCopy,
  isOperationalPrivateLaunchPath,
  validateOperationalPublicLaunchRegistry,
  validatePublicLaunchInventory,
} from "@/lib/marketing/operational-public-launch";
import { SITEMAP_PATHS } from "@/lib/marketing/public-paths";

describe("operational public launch registry", () => {
  it("covers launch boundaries, private surfaces, conversion flows, and assets", () => {
    expect(OPERATIONAL_PUBLIC_LAUNCH_BOUNDARY_IDS).toEqual(
      expect.arrayContaining([
        "core-contract-tracking",
        "not-full-clm",
        "no-legal-advice",
        "no-autonomous-agent",
        "human-reviewed-ai",
      ])
    );
    expect(OPERATIONAL_PRIVATE_SURFACE_IDS).toEqual(
      expect.arrayContaining([
        "advanced-decisions",
        "advanced-campaigns",
        "assurance-hub",
        "command-palette-private-results",
      ])
    );
    expect(OPERATIONAL_CONVERSION_FLOW_IDS).toEqual(
      expect.arrayContaining(["contact-api", "pricing-page", "signup-form", "billing-checkout-handoff"])
    );
    expect(OPERATIONAL_MARKETING_ASSET_METADATA_IDS).toEqual(
      expect.arrayContaining(["canonical-url", "opengraph-image", "json-ld-safe-serialization", "robots-private-disallow"])
    );
  });

  it("accepts negated boundary copy but rejects affirmative launch overclaims", () => {
    expect(
      evaluatePublicLaunchCopy(
        "Oblixa is not a full CLM, does not provide legal advice, and is not an autonomous agent."
      )
    ).toEqual({ ok: true, issues: [] });

    const result = evaluatePublicLaunchCopy(
      "Oblixa provides legal advice and acts as an autonomous agent for contract decisions."
    );

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.target)).toEqual(
      expect.arrayContaining(["legal-advice", "autonomous-agent"])
    );
  });

  it("keeps private launch surfaces out of public inventories", () => {
    expect(isOperationalPrivateLaunchPath("/assurance/findings")).toBe(true);
    expect(isOperationalPrivateLaunchPath("/pricing")).toBe(false);

    expect(validatePublicLaunchInventory(SITEMAP_PATHS).ok).toBe(true);
    expect(validatePublicLaunchInventory(["/", "/pricing", "/assurance"])).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            issue: "private_launch_path_in_public_inventory",
            target: "/assurance",
          }),
        ]),
      })
    );
  });

  it("validates the code-owned registry against current public paths", () => {
    expect(validateOperationalPublicLaunchRegistry()).toEqual({ ok: true, issues: [] });
  });
});
