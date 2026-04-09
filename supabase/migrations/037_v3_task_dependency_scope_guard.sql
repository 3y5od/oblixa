-- Enforce task dependency scope integrity.
-- Apply after 036_operational_optimization_indexes.sql

create or replace function public.enforce_task_dependency_scope()
returns trigger
language plpgsql
as $$
declare
  task_scope record;
  depends_scope record;
begin
  select organization_id, contract_id
  into task_scope
  from public.contract_tasks
  where id = new.task_id;

  select organization_id, contract_id
  into depends_scope
  from public.contract_tasks
  where id = new.depends_on_task_id;

  if task_scope.organization_id is null or depends_scope.organization_id is null then
    raise exception 'task dependency references missing task row';
  end if;

  if new.organization_id <> task_scope.organization_id
     or new.organization_id <> depends_scope.organization_id then
    raise exception 'task dependency organization mismatch';
  end if;

  if new.contract_id <> task_scope.contract_id
     or new.contract_id <> depends_scope.contract_id then
    raise exception 'task dependency contract mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_contract_task_dependencies_scope on public.contract_task_dependencies;
create trigger enforce_contract_task_dependencies_scope
  before insert or update on public.contract_task_dependencies
  for each row execute function public.enforce_task_dependency_scope();
