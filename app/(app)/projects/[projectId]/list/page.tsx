import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/getCurrentUser';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Props {
  params: Promise<{ projectId: string }>;
}

interface ListRow {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  status: { name: string; color: string } | null;
  assignee: { full_name: string | null; email: string } | null;
}

const priorityChip: Record<ListRow['priority'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

export default async function ListPage({ params }: Props) {
  const { projectId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('tasks')
    .select(
      `id, title, priority, due_date,
       status:statuses!status_id (name, color),
       assignee:users!assigned_to (full_name, email)`,
    )
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  const rows = (data ?? []) as unknown as ListRow[];

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Assignee</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No tasks yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/projects/${projectId}/board?task=${row.id}`}
                      className="hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.status ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: row.status.color }}
                        />
                        {row.status.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.assignee?.full_name ?? row.assignee?.email ?? 'Unassigned'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium uppercase',
                        priorityChip[row.priority],
                      )}
                    >
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.due_date ? format(new Date(row.due_date), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
