import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import type { Status } from '@/types/domain';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function WorkflowSettingsPage({ params }: Props) {
  const { projectId } = await params;
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data: workflow } = await supabase
    .from('workflows')
    .select(
      'id, project_id, statuses(id, workflow_id, name, position, color, is_terminal, created_at)',
    )
    .eq('project_id', projectId)
    .maybeSingle();

  if (!workflow) notFound();

  const statuses = ((workflow.statuses ?? []) as Status[])
    .slice()
    .sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <h2 className="text-lg font-semibold">Workflow</h2>
        <p className="text-sm text-muted-foreground">
          Define the columns that appear on this project&apos;s Kanban board. Drag to reorder.
        </p>
      </header>

      <WorkflowBuilder workflowId={workflow.id} projectId={projectId} initialStatuses={statuses} />
    </div>
  );
}
