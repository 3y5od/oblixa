export const uiRouteFixtureManifest = [
  {
    route: "/contracts/[id]",
    fixtureId: "contract-default",
    visitPath: "/contracts/00000000-0000-0000-0000-000000000000",
  },
  {
    route: "/campaigns/[id]",
    fixtureId: "campaign-default",
    visitPath: "/campaigns/00000000-0000-0000-0000-000000000001",
  },
  {
    route: "/decisions/[id]",
    fixtureId: "decision-default",
    visitPath: "/decisions/00000000-0000-0000-0000-000000000002",
  },
  {
    route: "/accounts/[key]",
    fixtureId: "account-default",
    visitPath: "/accounts/example-account",
  },
  {
    route: "/counterparties/[key]",
    fixtureId: "counterparty-default",
    visitPath: "/counterparties/example-counterparty",
  },
  {
    route: "/assurance/findings/[id]",
    fixtureId: "assurance-finding-default",
    visitPath: "/assurance/findings/00000000-0000-0000-0000-000000000003",
  },
  {
    route: "/assurance/control-policies/[id]",
    fixtureId: "control-policy-default",
    visitPath: "/assurance/control-policies/00000000-0000-0000-0000-000000000004",
  },
  {
    route: "/external/[token]",
    fixtureId: "external-token-default",
    visitPath: "/external/00000000-0000-0000-0000-000000000000",
  },
];

export function getUiRouteFixture(route) {
  return uiRouteFixtureManifest.find((entry) => entry.route === route) ?? null;
}

export function resolveUiRouteVisitPath(route) {
  return getUiRouteFixture(route)?.visitPath ?? (route.includes("[") ? null : route);
}
