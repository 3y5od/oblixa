-- Supabase Auth user deletion runs DELETE on auth.users. Any public-schema foreign
-- key to auth.users without ON DELETE still defaults to NO ACTION and raises
-- a foreign-key violation ("Database error deleting user"). Recreate those
-- constraints with SET NULL (nullable actor columns) or CASCADE (NOT NULL user ids).

do $migration$
declare
  rec record;
  fq_table text;
  cmd text;
begin
  for rec in
    select
      c.conname as constraint_name,
      ns.nspname as table_schema,
      cl.relname as table_name,
      (
        select string_agg(quote_ident(a.attname), ', ' order by u.ordinality)
        from unnest(c.conkey) with ordinality as u(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid
          and a.attnum = u.attnum
          and not a.attisdropped
      ) as col_list,
      (
        select bool_and(a.attnotnull = false)
        from unnest(c.conkey) as x(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid
          and a.attnum = x.attnum
          and not a.attisdropped
      ) as all_columns_nullable
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and ns.nspname = 'public'
      -- 'a' = no action, 'r' = restrict (default blocks deletes on referenced auth.users)
      and c.confdeltype in ('a'::"char", 'r'::"char")
  loop
    if rec.col_list is null then
      raise notice 'Skipping constraint % (missing column metadata)', rec.constraint_name;
      continue;
    end if;

    fq_table := format('%I.%I', rec.table_schema, rec.table_name);

    execute format('alter table %s drop constraint if exists %I', fq_table, rec.constraint_name);

    if coalesce(rec.all_columns_nullable, false) then
      execute format(
        'alter table %s add constraint %I foreign key (%s) references auth.users(id) on delete set null',
        fq_table,
        rec.constraint_name,
        rec.col_list
      );
    else
      execute format(
        'alter table %s add constraint %I foreign key (%s) references auth.users(id) on delete cascade',
        fq_table,
        rec.constraint_name,
        rec.col_list
      );
    end if;
  end loop;
end;
$migration$;
