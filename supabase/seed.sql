-- ════════════════════════════════════════════════════════════════════════
-- seed.sql — Development seed data (idempotent)
--
-- Runs after migrations on `supabase db reset`. Auth users cannot be
-- created from raw SQL alone, so this seed:
--
--   1. Inserts demo auth users via auth.admin tables (local dev only).
--   2. Promotes one to admin in public.users.
--   3. Creates a demo project (which auto-creates workflow + statuses
--      via tg_init_project_workflow).
--   4. Adds a few sample tasks across the default columns.
--
-- IMPORTANT: this seed targets local Supabase only. Do NOT run against
-- production — auth.users password hashes and identities are managed
-- by Supabase Auth in production.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  admin_uid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  pm_uid    uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  user_uid  uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  demo_project_id uuid;
  todo_id uuid;
  in_progress_id uuid;
  review_id uuid;
begin
  -- ── 1. Auth users (local dev shortcut) ───────────────────────────────
  -- Skip if not running against the local instance (no aud column = prod).
  if not exists (select 1 from pg_class where relname = 'identities' and relnamespace = 'auth'::regnamespace) then
    raise notice 'auth schema not found; skipping seed';
    return;
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    (admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@tasktrack.dev', crypt('Password123!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Demo Admin"}'::jsonb),
    (pm_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pm@tasktrack.dev', crypt('Password123!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Demo PM"}'::jsonb),
    (user_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'user@tasktrack.dev', crypt('Password123!', gen_salt('bf')),
     now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Demo User"}'::jsonb)
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values
    (gen_random_uuid(), admin_uid,
     jsonb_build_object('sub', admin_uid::text, 'email', 'admin@tasktrack.dev'),
     'email', admin_uid::text, now(), now(), now()),
    (gen_random_uuid(), pm_uid,
     jsonb_build_object('sub', pm_uid::text, 'email', 'pm@tasktrack.dev'),
     'email', pm_uid::text, now(), now(), now()),
    (gen_random_uuid(), user_uid,
     jsonb_build_object('sub', user_uid::text, 'email', 'user@tasktrack.dev'),
     'email', user_uid::text, now(), now(), now())
  on conflict do nothing;

  -- tg_sync_auth_user populates public.users on auth.users insert.
  -- Promote our admin.
  update public.users set role = 'admin', full_name = 'Demo Admin' where id = admin_uid;
  update public.users set role = 'pm',    full_name = 'Demo PM'    where id = pm_uid;
  update public.users set role = 'user',  full_name = 'Demo User'  where id = user_uid;

  -- ── 2. Demo project (triggers create workflow + statuses) ────────────
  insert into public.projects (id, name, description, created_by)
  values (gen_random_uuid(), 'Demo Project',
          'Sample project for local development', admin_uid)
  returning id into demo_project_id;

  -- Add the PM and the regular user as members.
  insert into public.project_members (project_id, user_id, role, added_by) values
    (demo_project_id, pm_uid,   'pm',     admin_uid),
    (demo_project_id, user_uid, 'member', admin_uid)
  on conflict do nothing;

  -- Grab the auto-created statuses
  select id into todo_id        from public.statuses where workflow_id = (select id from public.workflows where project_id = demo_project_id) and name = 'Todo';
  select id into in_progress_id from public.statuses where workflow_id = (select id from public.workflows where project_id = demo_project_id) and name = 'In Progress';
  select id into review_id      from public.statuses where workflow_id = (select id from public.workflows where project_id = demo_project_id) and name = 'Review';

  -- ── 3. Sample tasks ──────────────────────────────────────────────────
  insert into public.tasks (project_id, title, description, status_id, assigned_to, created_by, priority, position) values
    (demo_project_id, 'Set up onboarding flow',  'Wire up the new-user welcome screen.', todo_id,        user_uid,  admin_uid, 'high',   1024),
    (demo_project_id, 'Design Kanban card',      'Mockup for the task card on the board.', todo_id,       pm_uid,    admin_uid, 'medium', 2048),
    (demo_project_id, 'Implement login page',    null,                                     in_progress_id, user_uid, pm_uid,    'high',   1024),
    (demo_project_id, 'Review RLS policies',     'Verify each policy with a test user.',   review_id,      pm_uid,   admin_uid, 'high',   1024);

  raise notice 'Seed complete: 3 users, 1 project, 4 tasks';
end $$;
