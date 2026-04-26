# Task Track — Project Context

> Living reference for anyone (human or AI) working on this codebase.
> Update this file when architecture, conventions, or scope change.

---

## 1. What this is

**Task Track** — a Jira-like task management SaaS for small startups. Kanban-first UX with strict RBAC and per-project custom workflows. Source of truth for the product spec is [Task Track PRD.pdf](Task%20Track%20PRD.pdf).

### Core value proposition
- Simpler than Jira
- Structured enough for real project management
- Fast onboarding, low cognitive load

### MVP scope (strict)
- Email/password auth + role assignment
- Project CRUD with member + PM assignment
- Per-project custom workflow (statuses with order + color)
- Task CRUD with assignment, priority, due date
- Kanban board with drag-and-drop + realtime
- Threaded comments + activity log
- In-app notifications

### Out of scope (post-MVP)
- File attachments
- Time tracking
- Sprints
- Reporting dashboard
- Email notifications
- Keyboard shortcuts

---

## 2. Tech stack (fixed)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) on Vercel | Server Components for data fetching, Server Actions for mutations |
| UI | Tailwind + shadcn/ui | Owned components, no lock-in |
| DnD | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible, performant, modern |
| Server state | TanStack Query v5 | Realtime-friendly, optimistic updates |
| UI state | Zustand (per-page stores) + URL params | Avoid global mega-store |
| Validation | Zod | Shared between client and server actions |
| Auth | Supabase Auth (email + password) | Cookie-based session via `@supabase/ssr` |
| DB | Supabase Postgres 15+ | Managed, with built-in RLS |
| Realtime | Supabase Realtime (Postgres CDC) | RLS-respecting subscriptions |
| Storage | Supabase Storage | Phase 2 (file attachments) |
| Optional API | Fastify on Render | Only if/when async jobs needed |

---

## 3. Architecture decisions

1. **Frontend talks directly to Supabase.** Next.js Server Components/Actions act as the privileged layer for admin-only operations (e.g., creating users via service role). No separate Render API for MVP.
2. **RLS is the primary security boundary.** Server-side checks are belt; client-side checks are cosmetic UX.
3. **Two-tier role model**:
   - `users.role` ∈ `{admin, pm, user}` — system-level (mostly an Admin gate; `pm`/`user` are labels).
   - `project_members.role` ∈ `{pm, member}` — project-level. **This is what RLS actually checks** for project-scoped permissions.
4. **One workflow per project** (PRD's data model is 1:1). Multiple workflows would be a v2 schema change.
5. **Fractional indexing** for task ordering within a column — supports concurrent drags without lock contention.
6. **Deleted users** retain referential integrity: `assigned_to` becomes `NULL`, `created_by` is `RESTRICT` (admin must reassign first).
7. **Triggers enforce cross-table invariants** (assignee must be project member, status must belong to project's workflow). Application code cannot violate them.
8. **Activity log is append-only** — no client INSERT policy; only triggers (running with table-owner privileges) write to it.

---

## 4. Repository layout

```
.
├── app/                          # Next.js App Router
│   ├── (auth)/login              # public auth pages
│   ├── (app)/                    # authenticated shell
│   │   ├── projects/             # list + per-project routes (board, list, settings)
│   │   ├── my-tasks/             # personalized dashboard
│   │   └── admin/                # admin panel (users, projects, workflows)
│   └── api/                      # route handlers (only when SA insufficient)
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── kanban/               # board, column, card, realtime hook
│   │   ├── tasks/                # detail dialog, form, comment thread
│   │   ├── workflow/             # workflow builder
│   │   └── shared/               # RoleGate, ProjectRoleGate
│   ├── lib/
│   │   ├── supabase/             # client.ts, server.ts, service.ts, middleware.ts
│   │   ├── auth/                 # getCurrentUser, requireRole
│   │   ├── validation/           # zod schemas
│   │   ├── ordering/             # fractional position math
│   │   └── query/                # TanStack Query keys
│   ├── server/
│   │   └── actions/              # Next.js server actions per domain
│   ├── hooks/                    # useCurrentUser, useTasks, useRealtimeTasks, ...
│   ├── stores/                   # zustand UI stores
│   └── types/                    # db.ts (generated), domain.ts
├── supabase/
│   ├── migrations/               # 0001_init.sql, 0002_rls.sql, 0003_realtime.sql
│   └── seed.sql
├── middleware.ts                 # Next.js: refresh Supabase session on every request
├── context.md                    # this file
└── Task Track PRD.pdf            # source of truth for product spec
```

---

## 5. Conventions

- **TypeScript everywhere.** No `any` without an explanatory comment.
- **No `console.log` in committed code.** Use a `logger` (Phase 2) or remove before commit.
- **Server-only modules** must start with `import 'server-only';` — `src/lib/supabase/service.ts` and anything that touches `SUPABASE_SERVICE_ROLE_KEY`.
- **Server actions** live in `src/server/actions/<domain>.ts`, validate input with Zod, and re-check auth with `requireUser`/`requireRole`.
- **Database access from RSC** uses `createClient()` from `src/lib/supabase/server.ts` (anon key + user JWT — RLS enforced).
- **Privileged operations** (admin user creation, workflow migrations) use `supabaseService` from `src/lib/supabase/service.ts` and **must** re-verify the caller's role.
- **Component naming**: PascalCase files for components, camelCase for hooks/utils.
- **Folder colocation**: feature components live under `src/components/<feature>/`, not by type.
- **Zod schemas** are co-located in `src/lib/validation/<domain>.ts` and shared between server actions and client forms.
- **Migrations are immutable** once merged. New changes go in a new numbered migration file.

---

## 6. Environment variables

Defined in `.env.example`. Local dev copies to `.env.local`.

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public, RLS-gated |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Never** expose to client. Only imported in `src/lib/supabase/service.ts` and `src/server/actions/*` |
| `NEXT_PUBLIC_APP_URL` | Client + Server | Used for redirect URLs |

CI lint rule (TODO): forbid `SUPABASE_SERVICE_ROLE_KEY` references outside `src/server/` and `src/lib/supabase/service.ts`.

---

## 7. Local development

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Fill in values from your Supabase project (Settings → API)

# 3. Apply schema (requires supabase CLI + linked project)
supabase db push

# 4. Generate DB types
pnpm db:types

# 5. Run dev server
pnpm dev
```

Open http://localhost:3000.

---

## 8. RBAC quick reference

| Action | Admin | PM (of project) | Member (of project) |
|---|---|---|---|
| Create project | yes | no | no |
| Delete project | yes | no | no |
| Manage workflow (statuses) | yes | no | no |
| Add/remove project members | yes | yes (members only) | no |
| Create task | yes | yes | yes |
| Update task fields | yes | yes | yes |
| Update task status | yes | yes | yes |
| Assign task (to project member) | yes | yes | yes |
| Delete task | yes | yes | **no** |
| Comment on task | yes | yes | yes |
| Delete others' comments | yes | yes | no |
| Create users | yes | no | no |

These are enforced in this order:
1. **DB RLS policies** (authoritative)
2. **Server action guards** (`requireRole`, `requireProjectRole`)
3. **Client UI** via `<RoleGate>` / `<ProjectRoleGate>` (cosmetic only)

---

## 9. Build status

Track scaffolding progress here. Update as files land.

- [x] `context.md`
- [x] Step 1 — Foundation: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.example`, `middleware.ts`, `postcss.config.mjs`, `.gitignore`, `app/globals.css`
- [x] Step 2 — DB: `supabase/config.toml`, `migrations/0001_init.sql`, `0002_rls.sql`, `0003_realtime_rpcs.sql`, `seed.sql`
- [x] Step 3 — Supabase clients + auth helpers + validation schemas + providers
- [x] Step 4 — App shell: root layout, login page, app layout, sidebar, topbar, projects index, my-tasks, error/not-found
- [x] Step 5 — Projects + Kanban: project layout (membership 404), board + list views, DnD with optimistic moves + auto-reindex, server actions for projects/tasks, realtime task subscriptions
- [x] Step 6 — Workflow builder + admin panel: workflow CRUD with reorder + status migration on delete; admin pages for users (create/role/active/delete) and projects (archive/delete + new project form with PM/member matrix); project settings with members panel
- [x] Step 7 — Comments (realtime threaded) + per-task activity feed + notification bell with realtime + URL-driven task detail dialog with edit/comment/activity panels

---

## 10. Open questions / future decisions

- **Multi-tenancy**: currently single-tenant (one Supabase project = one organisation). If multi-org needed, add `organizations` table + `users.org_id` and scope all RLS by org.
- **Soft vs hard delete** for projects: schema supports both via `archived_at`. UI surfaces archive; hard delete is admin-only behind a confirm.
- **Reindex policy**: when fractional positions converge, a maintenance routine rewrites the column. Run it on demand (admin) or periodically (cron edge function)?
- **Column reorder = workflow change**: when a status is renamed/reordered, do we want to log it to `activity_logs`? Currently no — only task changes are logged. Revisit if PMs ask for it.
