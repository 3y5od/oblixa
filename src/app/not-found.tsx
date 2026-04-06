import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-zinc-300">404</p>
        <h2 className="mt-4 text-lg font-semibold text-zinc-900">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block ui-btn-primary"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
