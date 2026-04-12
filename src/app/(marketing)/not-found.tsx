import Link from "next/link";

export default function MarketingNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-canvas px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-600">
        That URL does not match a public page on this site.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="ui-btn-primary px-4 py-2 text-sm">
          Home
        </Link>
        <Link href="/signup" className="ui-btn-secondary px-4 py-2 text-sm">
          Sign up
        </Link>
      </div>
    </div>
  );
}
