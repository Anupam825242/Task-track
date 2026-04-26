import Link from 'next/link';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { Button } from '@/components/ui/button';
import { ProjectAdminActions } from '@/components/admin/ProjectAdminActions';

interface AdminProjectRow {
  id: string;
  name: string;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  members: Array<{ count: number }>;
}

export default async function AdminProjectsPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data } = await supabase
    .from('projects')
    .select('id, name, description, archived_at, created_at, members:project_members(count)')
    .order('created_at', { ascending: false });

  const projects = (data ?? []) as unknown as AdminProjectRow[];

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All projects</h2>
          <p className="text-sm text-muted-foreground">
            Includes archived projects. Only admins see this view.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/projects/new">
            <Plus className="h-4 w-4" /> New project
          </Link>
        </Button>
      </header>

      <ul className="divide-y rounded-lg border bg-card">
        {projects.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">No projects yet.</li>
        ) : (
          projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/projects/${p.id}/board`} className="text-sm font-medium hover:underline">
                  {p.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{p.members?.[0]?.count ?? 0} members</span>
                  <span>· Created {format(new Date(p.created_at), 'MMM d, yyyy')}</span>
                  {p.archived_at ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                      Archived
                    </span>
                  ) : null}
                </div>
              </div>
              <ProjectAdminActions
                projectId={p.id}
                isArchived={Boolean(p.archived_at)}
                ArchiveIcon={p.archived_at ? ArchiveRestore : Archive}
                DeleteIcon={Trash2}
              />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
