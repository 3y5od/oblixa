export default function ContractDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded bg-gray-200" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-64 rounded bg-gray-200" />
          <div className="h-4 w-40 rounded bg-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-72 rounded-lg border border-gray-200 bg-white" />
          <div className="h-48 rounded-lg border border-gray-200 bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-40 rounded-lg border border-gray-200 bg-white" />
          <div className="h-56 rounded-lg border border-gray-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
