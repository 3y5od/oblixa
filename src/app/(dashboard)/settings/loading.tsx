export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-pulse">
      <div className="h-8 w-28 rounded bg-gray-200" />
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="h-6 w-20 rounded bg-gray-200" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="h-32 rounded bg-gray-200" />
      </div>
    </div>
  );
}
