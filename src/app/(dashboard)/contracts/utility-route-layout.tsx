import { assertCoreUtilitySurfaceOrRedirect } from "@/lib/product-surface/route-guard";

/** Shared layout for §10.4 contract utility routes (analytics, intake, etc.). */
export default async function ContractsUtilityRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertCoreUtilitySurfaceOrRedirect();
  return <div className="ui-page-stack">{children}</div>;
}
