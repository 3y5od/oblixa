import Link from "next/link";
import { RouteStatePanel } from "@/components/ui/route-state-panel";

export default function NotFound() {
  return (
    <RouteStatePanel
      eyebrow="Route not found"
      title="This surface does not exist"
      copy="The page you are looking for may have moved, been gated for your workspace mode, or never existed in this environment."
      digest="404"
      digestLabel="Surface"
      cardClassName="ui-card-hero max-w-2xl shadow-[var(--shadow-2)]"
      actions={
        <>
          <Link href="/dashboard" className="ui-btn-primary px-5 py-2.5 text-[13px]">
            Go to dashboard
          </Link>
          <Link href="/more" className="ui-btn-secondary px-5 py-2.5 text-[13px]">
            Browse tools
          </Link>
        </>
      }
    />
  );
}
