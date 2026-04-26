import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/getCurrentUser';
import { Button } from '@/components/ui/button';
import { RoleGate } from '@/components/shared/RoleGate';
import type { Project } from '@/types/domain';

export default async function ProjectsPage() {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('projects')
    .select('id, name, description, created_by, archived_at, created_at, updated_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const projects = (data ?? []) as Project[];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Boards you have access to. Drag tasks across the workflow to update status.
          </p>
        </div>
        <RoleGate allow={['admin']}>
          <Button asChild>
            <Link href="/admin/projects/new">New project</Link>
          </Button>
        </RoleGate>
      </header>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}/board`}
                className="group block h-full rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 font-medium tracking-tight">{p.name}</h2>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                {p.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h2 className="text-base font-medium">No projects yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        An admin needs to create a project and add you as a member.
      </p>
      <RoleGate allow={['admin']}>
        <Button asChild className="mt-4">
          <Link href="/admin/projects/new">Create the first project</Link>
        </Button>
      </RoleGate>
    </div>
  );
}
