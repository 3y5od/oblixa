// `/renewals` and `/contracts/renewals` render the same page (see
// ../contracts/renewals/page, which this route re-exports). Their loading
// boundary must match too — re-export the canonical, up-to-date skeleton
// instead of maintaining a second copy that drifts from the live surface.
export { default } from "../contracts/renewals/loading";
