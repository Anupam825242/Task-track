-- ════════════════════════════════════════════════════════════════════════
-- 0003_realtime_rpcs.sql — Realtime publication + special-case RPCs
--
-- Realtime: respects RLS, so subscribed clients only receive rows they
-- are allowed to read.
--
-- RPCs: wrap operations that need transactional / privileged behaviour
-- (constraint deferral, atomic bulk updates, role checks).
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ─────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'statuses'
  ) then
    alter publication supabase_realtime add table public.statuses;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- reorder_statuses: atomic position rewrite within a workflow.
-- The (workflow_id, position) unique constraint is DEFERRABLE, so we
-- defer it inside this transaction to permit intermediate collisions.
-- Admin-only.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.reorder_statuses(
  p_workflow_id uuid,
  p_orders      jsonb  -- [{"id": "...", "position": 0}, ...]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  set constraints public.statuses_workflow_position_uq deferred;

  update public.statuses s
     set position = (o.value->>'position')::int
    from jsonb_array_elements(p_orders) as o
   where s.id = (o.value->>'id')::uuid
     and s.workflow_id = p_workflow_id;
end $$;

revoke execute on function public.reorder_statuses(uuid, jsonb) from public;
grant  execute on function public.reorder_statuses(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- migrate_status_tasks: atomically move all tasks from one status to
-- another. Required before deleting a status that still has tasks
-- (tasks.status_id has ON DELETE RESTRICT).
-- Admin or project PM.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.migrate_status_tasks(
  p_from_status_id uuid,
  p_to_status_id   uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  from_workflow uuid;
  to_workflow   uuid;
  proj_id       uuid;
  moved         integer;
begin
  select workflow_id into from_workflow from public.statuses where id = p_from_status_id;
  select workflow_id into to_workflow   from public.statuses where id = p_to_status_id;

  if from_workflow is null or to_workflow is null then
    raise exception 'status not found' using errcode = 'no_data_found';
  end if;
  if from_workflow <> to_workflow then
    raise exception 'cannot migrate tasks across workflows' using errcode = 'check_violation';
  end if;

  select project_id into proj_id from public.workflows where id = from_workflow;

  if not (public.is_admin() or public.is_project_pm(proj_id)) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  with moved_rows as (
    update public.tasks
       set status_id = p_to_status_id
     where status_id = p_from_status_id
     returning 1
  )
  select count(*) into moved from moved_rows;

  return coalesce(moved, 0);
end $$;

revoke execute on function public.migrate_status_tasks(uuid, uuid) from public;
grant  execute on function public.migrate_status_tasks(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- reindex_column_positions: rewrites task.position values within a
-- (project_id, status_id) bucket to a clean sequence (1024, 2048, ...).
-- Run when fractional gaps converge to MIN_GAP. Project PM or admin.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.reindex_column_positions(
  p_project_id uuid,
  p_status_id  uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare reindexed integer := 0;
begin
  if not (public.is_admin() or public.is_project_pm(p_project_id)) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  with ordered as (
    select id, row_number() over (order by position, created_at) as rn
      from public.tasks
     where project_id = p_project_id and status_id = p_status_id
  ),
  upd as (
    update public.tasks t
       set position = ordered.rn * 1024
      from ordered
     where t.id = ordered.id
     returning 1
  )
  select count(*) into reindexed from upd;

  return coalesce(reindexed, 0);
end $$;

revoke execute on function public.reindex_column_positions(uuid, uuid) from public;
grant  execute on function public.reindex_column_positions(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- mark_all_notifications_read: convenience for the bell UI
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare cnt integer;
begin
  with upd as (
    update public.notifications
       set read_at = now()
     where recipient_id = auth.uid() and read_at is null
     returning 1
  )
  select count(*) into cnt from upd;
  return coalesce(cnt, 0);
end $$;

revoke execute on function public.mark_all_notifications_read() from public;
grant  execute on function public.mark_all_notifications_read() to authenticated;
