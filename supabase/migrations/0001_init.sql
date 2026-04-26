-- ════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — Schema, enums, tables, indexes, helpers, triggers
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'pm', 'user');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_member_role') then
    create type public.project_member_role as enum ('pm', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high');
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_action') then
    create type public.activity_action as enum (
      'task_created', 'task_updated', 'task_deleted',
      'task_assigned', 'task_unassigned', 'task_status_changed',
      'comment_added', 'comment_deleted',
      'member_added', 'member_removed'
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- users (mirror of auth.users — keeps app columns out of auth schema)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext unique not null,
  full_name   text,
  avatar_url  text,
  role        public.user_role not null default 'user',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_users_role_active on public.users(role) where is_active;

-- ─────────────────────────────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  created_by  uuid not null references public.users(id) on delete restrict,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_projects_created_by on public.projects(created_by);
create index if not exists idx_projects_active     on public.projects(created_at desc) where archived_at is null;

-- ─────────────────────────────────────────────────────────────────────
-- project_members
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id)    on delete cascade,
  role       public.project_member_role not null default 'member',
  added_by   uuid references public.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_project_members_pm   on public.project_members(project_id) where role = 'pm';

-- ─────────────────────────────────────────────────────────────────────
-- workflows (one per project)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.workflows (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  name       text not null default 'Default Workflow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- statuses (workflow columns) — deferrable unique to allow swap reorders
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.statuses (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.workflows(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 50),
  position     integer not null check (position >= 0),
  color        text not null default '#6B7280' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_terminal  boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint statuses_workflow_name_uq unique (workflow_id, name),
  constraint statuses_workflow_position_uq unique (workflow_id, position)
    deferrable initially deferred
);
create index if not exists idx_statuses_workflow_pos on public.statuses(workflow_id, position);

-- ─────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 300),
  description  text check (description is null or char_length(description) <= 20000),
  status_id    uuid not null references public.statuses(id) on delete restrict,
  assigned_to  uuid references public.users(id) on delete set null,
  created_by   uuid not null references public.users(id) on delete restrict,
  priority     public.task_priority not null default 'medium',
  due_date     date,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_tasks_project  on public.tasks(project_id);
create index if not exists idx_tasks_status   on public.tasks(status_id);
create index if not exists idx_tasks_assigned on public.tasks(assigned_to) where assigned_to is not null;
create index if not exists idx_tasks_board    on public.tasks(project_id, status_id, position);
create index if not exists idx_tasks_due      on public.tasks(due_date) where due_date is not null;

-- ─────────────────────────────────────────────────────────────────────
-- comments (threaded via parent_id)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid references public.users(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 5000),
  parent_id  uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_comments_task on public.comments(task_id, created_at);

-- ─────────────────────────────────────────────────────────────────────
-- activity_logs (append-only — written exclusively by triggers)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id         bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  actor_id   uuid references public.users(id) on delete set null,
  action     public.activity_action not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_project on public.activity_logs(project_id, created_at desc);
create index if not exists idx_activity_task    on public.activity_logs(task_id, created_at desc) where task_id is not null;

-- ─────────────────────────────────────────────────────────────────────
-- notifications (in-app — written by triggers + server actions)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id           bigserial primary key,
  recipient_id uuid not null references public.users(id) on delete cascade,
  type         text not null,
  task_id      uuid references public.tasks(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notifications_unread
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;

-- ════════════════════════════════════════════════════════════════════════
-- Helper functions (used by RLS policies AND triggers)
-- All marked SECURITY DEFINER + STABLE so the planner can inline / cache
-- and so RLS lookups don't recurse into RLS-protected tables.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = uid and role = 'admin' and is_active
  );
$$;

create or replace function public.is_project_member(p_project_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = uid
  );
$$;

create or replace function public.is_project_pm(p_project_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = uid and role = 'pm'
  );
$$;

revoke execute on function
  public.is_admin(uuid),
  public.is_project_member(uuid, uuid),
  public.is_project_pm(uuid, uuid)
from public;

grant execute on function
  public.is_admin(uuid),
  public.is_project_member(uuid, uuid),
  public.is_project_pm(uuid, uuid)
to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════════

-- Generic updated_at maintainer
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_updated     on public.users;
drop trigger if exists trg_projects_updated  on public.projects;
drop trigger if exists trg_workflows_updated on public.workflows;
drop trigger if exists trg_tasks_updated     on public.tasks;
drop trigger if exists trg_comments_updated  on public.comments;

create trigger trg_users_updated     before update on public.users     for each row execute function public.tg_set_updated_at();
create trigger trg_projects_updated  before update on public.projects  for each row execute function public.tg_set_updated_at();
create trigger trg_workflows_updated before update on public.workflows for each row execute function public.tg_set_updated_at();
create trigger trg_tasks_updated     before update on public.tasks     for each row execute function public.tg_set_updated_at();
create trigger trg_comments_updated  before update on public.comments  for each row execute function public.tg_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- Sync auth.users → public.users
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.users.full_name, excluded.full_name);
  return new;
end $$;

drop trigger if exists trg_auth_user_sync on auth.users;
create trigger trg_auth_user_sync
  after insert or update of email on auth.users
  for each row execute function public.tg_sync_auth_user();

-- ─────────────────────────────────────────────────────────────────────
-- Prevent self role escalation (only admins may change user roles)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_users_protect_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change user roles'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists trg_users_protect_role on public.users;
create trigger trg_users_protect_role
  before update of role on public.users
  for each row execute function public.tg_users_protect_role();

-- ─────────────────────────────────────────────────────────────────────
-- Auto-create default workflow + statuses + creator membership on project insert
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_init_project_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare wf_id uuid;
begin
  insert into public.workflows (project_id) values (new.id) returning id into wf_id;

  insert into public.statuses (workflow_id, name, position, color, is_terminal) values
    (wf_id, 'Todo',        0, '#6B7280', false),
    (wf_id, 'In Progress', 1, '#3B82F6', false),
    (wf_id, 'Review',      2, '#F59E0B', false),
    (wf_id, 'Done',        3, '#10B981', true);

  insert into public.project_members (project_id, user_id, role, added_by)
  values (new.id, new.created_by, 'pm', new.created_by)
  on conflict (project_id, user_id) do update set role = 'pm';

  return new;
end $$;

drop trigger if exists trg_project_init on public.projects;
create trigger trg_project_init
  after insert on public.projects
  for each row execute function public.tg_init_project_workflow();

-- ─────────────────────────────────────────────────────────────────────
-- Validate task: assignee must be project member,
-- and status must belong to project's workflow
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_validate_task()
returns trigger
language plpgsql
as $$
declare status_project uuid;
begin
  if new.assigned_to is not null then
    if not exists (
      select 1 from public.project_members
      where project_id = new.project_id and user_id = new.assigned_to
    ) then
      raise exception 'Assignee % is not a member of project %', new.assigned_to, new.project_id
        using errcode = 'check_violation';
    end if;
  end if;

  select w.project_id into status_project
    from public.statuses s
    join public.workflows w on w.id = s.workflow_id
   where s.id = new.status_id;

  if status_project is null or status_project <> new.project_id then
    raise exception 'Status % does not belong to project %', new.status_id, new.project_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_task_validate on public.tasks;
create trigger trg_task_validate
  before insert or update of project_id, status_id, assigned_to on public.tasks
  for each row execute function public.tg_validate_task();

-- ─────────────────────────────────────────────────────────────────────
-- When a member is removed: unassign their tasks in that project
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_member_removed_unassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
     set assigned_to = null
   where project_id = old.project_id
     and assigned_to = old.user_id;
  return old;
end $$;

drop trigger if exists trg_member_removed_unassign on public.project_members;
create trigger trg_member_removed_unassign
  after delete on public.project_members
  for each row execute function public.tg_member_removed_unassign();

-- ─────────────────────────────────────────────────────────────────────
-- Activity log: tasks
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
    values (new.project_id, new.id, actor, 'task_created',
            jsonb_build_object('title', new.title, 'status_id', new.status_id));

  elsif (tg_op = 'UPDATE') then
    if new.status_id is distinct from old.status_id then
      insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
      values (new.project_id, new.id, actor, 'task_status_changed',
              jsonb_build_object('from', old.status_id, 'to', new.status_id));
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
      values (new.project_id, new.id, actor,
              case when new.assigned_to is null
                   then 'task_unassigned'::public.activity_action
                   else 'task_assigned'::public.activity_action end,
              jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
    end if;
    if (
      new.title       is distinct from old.title       or
      new.description is distinct from old.description or
      new.priority    is distinct from old.priority    or
      new.due_date    is distinct from old.due_date
    ) then
      insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
      values (new.project_id, new.id, actor, 'task_updated',
              jsonb_build_object(
                'title_changed',       new.title       is distinct from old.title,
                'description_changed', new.description is distinct from old.description,
                'priority_changed',    new.priority    is distinct from old.priority,
                'due_date_changed',    new.due_date    is distinct from old.due_date
              ));
    end if;

  elsif (tg_op = 'DELETE') then
    insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
    values (old.project_id, old.id, actor, 'task_deleted',
            jsonb_build_object('title', old.title));
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_task_activity on public.tasks;
create trigger trg_task_activity
  after insert or update or delete on public.tasks
  for each row execute function public.tg_task_activity();

-- ─────────────────────────────────────────────────────────────────────
-- Activity log: comments
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  task_project uuid;
begin
  if (tg_op = 'INSERT') then
    select project_id into task_project from public.tasks where id = new.task_id;
    if task_project is null then return new; end if;
    insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
    values (task_project, new.task_id, actor, 'comment_added',
            jsonb_build_object('comment_id', new.id, 'snippet', left(new.body, 200)));

  elsif (tg_op = 'DELETE') then
    select project_id into task_project from public.tasks where id = old.task_id;
    if task_project is null then return old; end if;
    insert into public.activity_logs (project_id, task_id, actor_id, action, payload)
    values (task_project, old.task_id, actor, 'comment_deleted',
            jsonb_build_object('comment_id', old.id));
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_comment_activity on public.comments;
create trigger trg_comment_activity
  after insert or delete on public.comments
  for each row execute function public.tg_comment_activity();

-- ─────────────────────────────────────────────────────────────────────
-- Activity log: project_members (add / remove)
-- Skips the log when the project itself is being deleted (cascade).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_member_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_logs (project_id, actor_id, action, payload)
    values (new.project_id, actor, 'member_added',
            jsonb_build_object('user_id', new.user_id, 'role', new.role));
    return new;

  elsif (tg_op = 'DELETE') then
    -- avoid FK violation when project is cascading away
    if not exists (select 1 from public.projects where id = old.project_id) then
      return old;
    end if;
    insert into public.activity_logs (project_id, actor_id, action, payload)
    values (old.project_id, actor, 'member_removed',
            jsonb_build_object('user_id', old.user_id));
    return old;
  end if;

  return null;
end $$;

drop trigger if exists trg_member_activity on public.project_members;
create trigger trg_member_activity
  after insert or delete on public.project_members
  for each row execute function public.tg_member_activity();

-- ─────────────────────────────────────────────────────────────────────
-- Notifications: tasks
--   - assignment changes → notify new assignee
--   - status changes     → notify creator + assignee (if !actor)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_task_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  -- assignment
  if (tg_op = 'INSERT' and new.assigned_to is not null)
     or (tg_op = 'UPDATE' and new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null)
  then
    if new.assigned_to is distinct from actor then
      insert into public.notifications (recipient_id, type, task_id, project_id, payload)
      values (new.assigned_to, 'task_assigned', new.id, new.project_id,
              jsonb_build_object('title', new.title, 'actor_id', actor));
    end if;
  end if;

  -- status change
  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id then
    if new.created_by is distinct from actor then
      insert into public.notifications (recipient_id, type, task_id, project_id, payload)
      values (new.created_by, 'task_status_changed', new.id, new.project_id,
              jsonb_build_object('title', new.title, 'from', old.status_id, 'to', new.status_id, 'actor_id', actor));
    end if;
    if new.assigned_to is not null
       and new.assigned_to is distinct from actor
       and new.assigned_to is distinct from new.created_by
    then
      insert into public.notifications (recipient_id, type, task_id, project_id, payload)
      values (new.assigned_to, 'task_status_changed', new.id, new.project_id,
              jsonb_build_object('title', new.title, 'from', old.status_id, 'to', new.status_id, 'actor_id', actor));
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_task_notifications on public.tasks;
create trigger trg_task_notifications
  after insert or update on public.tasks
  for each row execute function public.tg_task_notifications();

-- ─────────────────────────────────────────────────────────────────────
-- Notifications: comments → notify task assignee + creator (if not actor)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tg_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  t_id uuid;
  t_title text;
  t_project uuid;
  t_assigned uuid;
  t_created uuid;
begin
  select id, title, project_id, assigned_to, created_by
    into t_id, t_title, t_project, t_assigned, t_created
    from public.tasks where id = new.task_id;

  if t_id is null then return new; end if;

  if t_assigned is not null and t_assigned is distinct from actor then
    insert into public.notifications (recipient_id, type, task_id, project_id, payload)
    values (t_assigned, 'comment_added', t_id, t_project,
            jsonb_build_object('title', t_title, 'comment_id', new.id, 'actor_id', actor));
  end if;

  if t_created is not null
     and t_created is distinct from actor
     and t_created is distinct from t_assigned
  then
    insert into public.notifications (recipient_id, type, task_id, project_id, payload)
    values (t_created, 'comment_added', t_id, t_project,
            jsonb_build_object('title', t_title, 'comment_id', new.id, 'actor_id', actor));
  end if;

  return new;
end $$;

drop trigger if exists trg_comment_notifications on public.comments;
create trigger trg_comment_notifications
  after insert on public.comments
  for each row execute function public.tg_comment_notifications();
