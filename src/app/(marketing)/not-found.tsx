import Link from "next/link";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export default function MarketingNotFound() {
  return (
    <RouteStatePanel
      eyebrow="Public page"
      title="Page not found"
      copy="That URL does not match a public page on this site."
      shellClassName="bg-canvas"
      actions={
        <>
          <Link href="/" className="ui-btn-primary px-4 py-2 text-sm">
            Home
          </Link>
          <Link href="/signup" className="ui-btn-secondary px-4 py-2 text-sm">
            Sign up
          </Link>
        </>
      }
    />
  );
}
