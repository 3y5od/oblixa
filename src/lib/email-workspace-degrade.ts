import type { WorkspaceProductMode } from "@/lib/product-surface/types";

/**
 * docs/refinement.md §18 — Core outbound email must not foreground Advanced/Assurance-only module names.
 * Advanced/Assurance workspaces may use full product vocabulary in digests.
 */
export function emailCopyUsesCoreSurface(mode: WorkspaceProductMode | undefined): boolean {
  return mode == null || mode === "core";
}

/** Longer phrases first so we do not leave odd fragments. */
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/outcome intelligence/gi, "outcomes"],
  [/program evolution/gi, "program changes"],
  [/segment assurance/gi, "segment review"],
  [/portfolio health graph/gi, "portfolio health"],
  [/health graph/gi, "portfolio health"],
  [/review board/gi, "review cycle"],
  [/review boards/gi, "review cycles"],
  [/control policies/gi, "policy checks"],
  [/control policy/gi, "policy check"],
  [/scorecards/gi, "summaries"],
  [/scorecard/gi, "summary"],
  [/playbooks/gi, "response packs"],
  [/playbook/gi, "response pack"],
  [/autopilot/gi, "automation"],
  [/assurance analytics/gi, "analytics"],
  [/assurance/gi, "compliance"],
];

/**
 * Neutralize contained-module lemmas in user-visible email copy for Core workspaces.
 */
export function degradeOutboundEmailCopyForCore(text: string): string {
  let out = text;
  for (const [re, rep] of PHRASE_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out;
}
