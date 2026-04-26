import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/getCurrentUser';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MyTaskRow {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  project_id: string;
  status: { name: string; color: string } | null;
  project: { name: string } | null;
}

const priorityChipClass: Record<MyTaskRow['priority'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

export default async function MyTasksPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('tasks')
    .select(
      `id, title, priority, due_date, project_id,
       status:statuses!status_id (name, color),
       project:projects!project_id (name)`,
    )
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(200);

  const tasks = (data ?? []) as unknown as MyTaskRow[];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Tasks assigned to you across all your projects.
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing assigned to you. Enjoy the silence.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {tasks.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <Link
                href={`/projects/${t.project_id}/board?task=${t.id}`}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {t.status ? (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.status.color }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate text-sm font-medium">{t.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t.project?.name ?? 'Unknown project'}</span>
                    {t.status ? <span>· {t.status.name}</span> : null}
                    {t.due_date ? <span>· Due {format(new Date(t.due_date), 'MMM d')}</span> : null}
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
                    priorityChipClass[t.priority],
                  )}
                >
                  {t.priority}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
