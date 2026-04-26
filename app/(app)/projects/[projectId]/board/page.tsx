import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/getCurrentUser';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import type { Status, Task, AppUser } from '@/types/domain';

interface BoardPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { projectId } = await params;
  await requireUser();
  const supabase = await createClient();

  const [{ data: workflow }, { data: tasks }, { data: members }] = await Promise.all([
    supabase
      .from('workflows')
      .select('id, project_id, statuses(id, workflow_id, name, position, color, is_terminal, created_at)')
      .eq('project_id', projectId)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select(
        'id, project_id, title, description, status_id, assigned_to, created_by, priority, due_date, position, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .order('position', { ascending: true }),
    supabase
      .from('project_members')
      .select('user_id, role, user:users!user_id(id, email, full_name, avatar_url, role, is_active)')
      .eq('project_id', projectId),
  ]);

  if (!workflow) notFound();

  const statuses = ((workflow.statuses ?? []) as Status[])
    .slice()
    .sort((a, b) => a.position - b.position);

  const projectMembers = ((members ?? []) as Array<{ user: AppUser | null }>)
    .map((m) => m.user)
    .filter((u): u is AppUser => Boolean(u));

  return (
    <>
      <KanbanBoard
        projectId={projectId}
        statuses={statuses}
        initialTasks={(tasks ?? []) as Task[]}
        members={projectMembers}
      />
      <TaskDetailDialog projectId={projectId} statuses={statuses} members={projectMembers} />
    </>
  );
}
