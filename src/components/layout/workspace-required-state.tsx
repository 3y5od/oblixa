type WorkspaceRequiredStateProps = {
  title?: string;
  message?: string;
};

export function WorkspaceRequiredState({
  title = "No workspace linked",
  message = "Your account is not linked to an organization yet. Refresh this page, then contact your workspace admin if this keeps happening.",
}: WorkspaceRequiredStateProps) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-zinc-200/80 bg-white/50 px-6 py-16">
      <div className="max-w-sm text-center">
        <p className="ui-eyebrow text-zinc-400">Organization</p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
