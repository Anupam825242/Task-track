-- ════════════════════════════════════════════════════════════════════════
-- 0002_rls.sql — Row Level Security policies
--
-- Authoritative permission model:
--   • is_admin()                 — system-wide gate
--   • is_project_member(p_id)    — project-scoped read access
--   • is_project_pm(p_id)        — project-scoped elevated permissions
--
-- All helpers are SECURITY DEFINER (defined in 0001_init.sql) to avoid
-- RLS recursion when policies SELECT from project_members / users.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────
alter table public.users           enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.workflows       enable row level security;
alter table public.statuses        enable row level security;
alter table public.tasks           enable row level security;
alter table public.comments        enable row level security;
alter table public.activity_logs   enable row level security;
alter table public.notifications   enable row level security;

-- Force RLS even for table owners on regular client traffic.
-- (Service role bypasses RLS regardless.)
alter table public.users           force row level security;
alter table public.projects        force row level security;
alter table public.project_members force row level security;
alter table public.workflows       force row level security;
alter table public.statuses        force row level security;
alter table public.tasks           force row level security;
alter table public.comments        force row level security;
alter table public.activity_logs   force row level security;
alter table public.notifications   force row level security;

-- ════════════════════════════════════════════════════════════════════════
-- users
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists users_select_shared_project on public.users;
create policy users_select_shared_project on public.users
  for select to authenticated
  using (
    exists (
      select 1
        from public.project_members pm1
        join public.project_members pm2 on pm1.project_id = pm2.project_id
       where pm1.user_id = auth.uid() and pm2.user_id = public.users.id
    )
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
  -- Role escalation is blocked by the tg_users_protect_role trigger.

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- projects
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_admin() or public.is_project_member(id));

drop policy if exists projects_admin_write on public.projects;
create policy projects_admin_write on public.projects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- project_members
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists pm_select on public.project_members;
create policy pm_select on public.project_members
  for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));

drop policy if exists pm_admin_write on public.project_members;
create policy pm_admin_write on public.project_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- PMs may add regular members to their own projects (not other PMs)
drop policy if exists pm_pm_add_member on public.project_members;
create policy pm_pm_add_member on public.project_members
  for insert to authenticated
  with check (public.is_project_pm(project_id) and role = 'member');

-- PMs may remove regular members from their own projects (not other PMs)
drop policy if exists pm_pm_remove_member on public.project_members;
create policy pm_pm_remove_member on public.project_members
  for delete to authenticated
  using (public.is_project_pm(project_id) and role = 'member');

-- ════════════════════════════════════════════════════════════════════════
-- workflows
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists wf_select on public.workflows;
create policy wf_select on public.workflows
  for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));

drop policy if exists wf_admin_write on public.workflows;
create policy wf_admin_write on public.workflows
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- statuses
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists st_select on public.statuses;
create policy st_select on public.statuses
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.workflows w
       where w.id = statuses.workflow_id
         and public.is_project_member(w.project_id)
    )
  );

drop policy if exists st_admin_write on public.statuses;
create policy st_admin_write on public.statuses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- tasks
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    (public.is_admin() or public.is_project_member(project_id))
    and created_by = auth.uid()
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using  (public.is_admin() or public.is_project_member(project_id))
  with check (public.is_admin() or public.is_project_member(project_id));

-- Only admins or PMs of the project may delete tasks (PRD: Users CANNOT delete)
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_admin() or public.is_project_pm(project_id));

-- ════════════════════════════════════════════════════════════════════════
-- comments
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
       where t.id = comments.task_id
         and (public.is_admin() or public.is_project_member(t.project_id))
    )
  );

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
       where t.id = comments.task_id
         and (public.is_admin() or public.is_project_member(t.project_id))
    )
  );

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using  (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists comments_delete_own_or_pm on public.comments;
create policy comments_delete_own_or_pm on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.tasks t
       where t.id = comments.task_id and public.is_project_pm(t.project_id)
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- activity_logs (read-only to clients)
-- Inserts come exclusively from triggers (running as table owner).
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists logs_select on public.activity_logs;
create policy logs_select on public.activity_logs
  for select to authenticated
  using (public.is_admin() or public.is_project_member(project_id));

-- ════════════════════════════════════════════════════════════════════════
-- notifications (own-only)
-- Inserts come from triggers / service-role server actions.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists notifs_select_own on public.notifications;
create policy notifs_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

drop policy if exists notifs_update_own on public.notifications;
create policy notifs_update_own on public.notifications
  for update to authenticated
  using  (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists notifs_delete_own on public.notifications;
create policy notifs_delete_own on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());
