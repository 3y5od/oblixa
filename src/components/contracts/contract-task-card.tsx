import { UiSelect } from "@/components/ui/ui-select";
import { STATUS_OPTIONS } from "@/components/contracts/contract-tasks-panel-options";
import type { ContractTaskStatus } from "@/lib/types";
import type { ExecutionGraphEdgeRow } from "@/lib/contract-operations/graph-edge-labels";
import { ContractTaskArtifacts } from "./contract-task-artifacts";
import { ContractTaskChecklist } from "./contract-task-checklist";
import { ContractTaskComments } from "./contract-task-comments";
import { ContractTaskSummary } from "./contract-task-summary";
import type {
  ContractTaskArtifact,
  ContractTaskChecklistItem,
  ContractTaskComment,
  ContractTaskDependency,
  ContractTaskEvent,
  ContractTaskListItem,
  ContractTaskMutationHandlers,
} from "./contract-tasks-panel-types";

export function ContractTaskCard({
  task,
  tasks,
  memberById,
  taskTitleById,
  comments,
  taskEvents,
  taskChecklistItems,
  taskDependencies,
  taskArtifacts,
  executionGraphEdges,
  canEdit,
  isPending,
  handlers,
}: {
  task: ContractTaskListItem;
  tasks: ContractTaskListItem[];
  memberById: ReadonlyMap<string, string>;
  taskTitleById: ReadonlyMap<string, string>;
  comments: ContractTaskComment[];
  taskEvents: ContractTaskEvent[];
  taskChecklistItems: ContractTaskChecklistItem[];
  taskDependencies: ContractTaskDependency[];
  taskArtifacts: ContractTaskArtifact[];
  executionGraphEdges?: ExecutionGraphEdgeRow[];
  canEdit: boolean;
  isPending: boolean;
  handlers: ContractTaskMutationHandlers;
}) {
  return (
    <li className="rounded-xl border border-[var(--border-subtle)] bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ContractTaskSummary
            task={task}
            memberById={memberById}
            taskTitleById={taskTitleById}
            taskEvents={taskEvents}
            taskDependencies={taskDependencies}
            executionGraphEdges={executionGraphEdges}
          />
          <ContractTaskChecklist
            taskId={task.id}
            items={taskChecklistItems}
            canEdit={canEdit}
            isPending={isPending}
            onToggle={handlers.onToggleChecklistItem}
            onAdd={handlers.onAddChecklistItem}
            onUpdate={handlers.onUpdateChecklistItem}
            onDelete={handlers.onDeleteChecklistItem}
            onMove={handlers.onMoveChecklistItem}
          />
          <ContractTaskComments
            taskId={task.id}
            comments={comments}
            isPending={isPending}
            onAdd={handlers.onAddComment}
            onUpdate={handlers.onUpdateComment}
            onDelete={handlers.onDeleteComment}
          />
          <ContractTaskArtifacts
            taskId={task.id}
            artifacts={taskArtifacts}
            canEdit={canEdit}
            isPending={isPending}
            onAdd={handlers.onAddArtifact}
            onDelete={handlers.onDeleteArtifact}
          />
        </div>
        <ContractTaskCardActions
          task={task}
          tasks={tasks}
          canEdit={canEdit}
          isPending={isPending}
          onAddDependency={handlers.onAddDependency}
          onStatusChange={handlers.onStatusChange}
          onDelete={handlers.onDelete}
        />
      </div>
    </li>
  );
}

function ContractTaskCardActions({
  task,
  tasks,
  canEdit,
  isPending,
  onAddDependency,
  onStatusChange,
  onDelete,
}: {
  task: ContractTaskListItem;
  tasks: ContractTaskListItem[];
  canEdit: boolean;
  isPending: boolean;
  onAddDependency: (taskId: string, formData: FormData) => void;
  onStatusChange: (taskId: string, status: ContractTaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {canEdit ? (
        <form action={onAddDependency.bind(null, task.id)} className="flex items-center gap-1">
          <UiSelect
            name="dependsOnTaskId"
            defaultValue=""
            ariaLabel="Add dependency"
            placeholder="Add dependency..."
            options={tasks
              .filter((candidate) => candidate.id !== task.id)
              .map((candidate) => ({ value: candidate.id, label: candidate.title }))}
            variant="compact"
            portal
            searchThreshold={8}
            className="min-w-[8rem]"
            buttonClassName="w-full !min-h-11 text-xs"
          />
          <button type="submit" className="ui-btn-secondary px-2 py-1.5 text-xs">
            Link
          </button>
        </form>
      ) : null}
      <UiSelect
        value={task.status}
        disabled={isPending}
        onChange={(value) => onStatusChange(task.id, value as ContractTaskStatus)}
        ariaLabel="Task status"
        options={STATUS_OPTIONS}
        variant="compact"
        portal
        className="min-w-[8.5rem]"
        buttonClassName="w-full !min-h-11 text-xs"
      />
      {canEdit ? (
        <button type="button" onClick={() => onDelete(task.id)} disabled={isPending} className="ui-btn-secondary px-3 py-1.5 text-xs">
          Remove
        </button>
      ) : null}
    </div>
  );
}
