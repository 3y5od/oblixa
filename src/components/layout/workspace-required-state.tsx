import { EmptyState } from "@/components/ui/empty-state";

type WorkspaceRequiredStateProps = {
  title?: string;
  message?: string;
};

export function WorkspaceRequiredState({
  title = "No workspace linked",
  message = "Your account is not linked to an organization yet. Refresh this page, then contact your workspace admin if this keeps happening.",
}: WorkspaceRequiredStateProps) {
  return (
    <div className="min-h-[48vh]">
      <EmptyState
        eyebrow="Workspace access"
        title={title}
        copy={message}
        action={
          <p className="ui-density-note">Ask a workspace admin to invite you to an organization.</p>
        }
      />
    </div>
  );
}
