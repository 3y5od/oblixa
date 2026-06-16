import { UiSelect } from "@/components/ui/ui-select";
import type { ContractTaskComment } from "./contract-tasks-panel-types";

export function ContractTaskComments({
  taskId,
  comments,
  isPending,
  onAdd,
  onUpdate,
  onDelete,
}: {
  taskId: string;
  comments: ContractTaskComment[];
  isPending: boolean;
  onAdd: (taskId: string, formData: FormData) => void;
  onUpdate: (commentId: string, formData: FormData) => void;
  onDelete: (commentId: string) => void;
}) {
  const sortedComments = comments
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 8);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--border-subtle)]/70 bg-[color:color-mix(in_oklab,var(--surface-muted)_45%,var(--canvas))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        Comments
      </p>
      <ul className="space-y-1">
        {sortedComments.map((comment) => (
          <li key={comment.id} className={`text-xs text-[var(--text-secondary)] ${comment.parent_comment_id ? "ml-4 border-l border-[var(--border-subtle)] pl-2" : ""}`}>
            <p>{comment.body}</p>
            {comment.edited_at ? <p className="text-[11px] text-[var(--text-tertiary)]">edited</p> : null}
            <CommentActions comment={comment} isPending={isPending} onUpdate={onUpdate} onDelete={onDelete} />
          </li>
        ))}
      </ul>
      <form action={onAdd.bind(null, taskId)} className="flex items-center gap-2">
        <input aria-label="Add comment" name="body" placeholder="Add comment" className="ui-input h-7 flex-1 text-[11px]" />
        <UiSelect
          name="parentCommentId"
          defaultValue=""
          ariaLabel="Reply to comment"
          options={[
            { value: "", label: "Top-level" },
            ...comments
              .filter((comment) => !comment.parent_comment_id)
              .map((comment) => ({ value: comment.id, label: `Reply to ${comment.body.slice(0, 20)}` })),
          ]}
          variant="compact"
          portal
          className="w-40"
          buttonClassName="w-full !min-h-11 text-[11px]"
        />
        <button type="submit" className="ui-btn-secondary px-2 py-1 text-[11px]">
          Add
        </button>
      </form>
    </div>
  );
}

function CommentActions({
  comment,
  isPending,
  onUpdate,
  onDelete,
}: {
  comment: ContractTaskComment;
  isPending: boolean;
  onUpdate: (commentId: string, formData: FormData) => void;
  onDelete: (commentId: string) => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-1">
      <form action={onUpdate.bind(null, comment.id)} className="flex items-center gap-1">
        <input aria-label="Edit comment" name="body" defaultValue={comment.deleted_at ? "" : comment.body} placeholder="Edit comment" className="ui-input h-6 w-44 text-[11px]" />
        <button type="submit" className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
          Save
        </button>
      </form>
      <button type="button" disabled={isPending} onClick={() => onDelete(comment.id)} className="ui-btn-secondary px-1.5 py-0.5 text-[11px]">
        Delete
      </button>
    </div>
  );
}
