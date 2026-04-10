const cardShell =
  "rounded-2xl border border-[var(--border-subtle)] bg-surface p-6 shadow-[var(--shadow-1)]";

export default function SettingsLoading() {
  return (
    <div className="ui-page-stack mx-auto max-w-4xl" aria-hidden>
      <div className="space-y-3">
        <div className="ui-skeleton h-4 w-24 rounded" />
        <div className="ui-skeleton h-9 w-48 rounded" />
        <div className="ui-skeleton h-4 max-w-xl rounded" />
      </div>
      <div className={`space-y-4 ${cardShell}`}>
        <div className="ui-skeleton h-6 w-20 rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="ui-skeleton h-10 rounded-lg" />
          <div className="ui-skeleton h-10 rounded-lg" />
        </div>
      </div>
      <div className={`space-y-4 ${cardShell}`}>
        <div className="ui-skeleton h-6 w-32 rounded" />
        <div className="ui-skeleton h-10 w-64 rounded-lg" />
        <div className="ui-skeleton h-32 rounded-xl" />
      </div>
    </div>
  );
}
