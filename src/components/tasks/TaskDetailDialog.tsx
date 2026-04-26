'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProjectRoleGate } from '@/components/shared/ProjectRoleGate';
import { CommentThread } from './CommentThread';
import { ActivityFeed } from './ActivityFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import { deleteTaskAction, updateTaskAction } from '@/server/actions/tasks';
import type { AppUser, Status, Task, TaskPriority } from '@/types/domain';

interface Props {
  projectId: string;
  statuses: Status[];
  members: AppUser[];
}

const priorities: TaskPriority[] = ['low', 'medium', 'high'];

/**
 * URL-driven task modal: opens whenever `?task=<uuid>` is in the search.
 * Closing clears the param via router.replace.
 */
export function TaskDetailDialog({ projectId, statuses, members }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get('task') ?? null;
  const isOpen = Boolean(taskId);

  function close() {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('task');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (!o ? close() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        {taskId ? (
          <TaskDialogContent
            taskId={taskId}
            projectId={projectId}
            statuses={statuses}
            members={members}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskDialogContent({
  taskId,
  projectId,
  statuses,
  members,
}: {
  taskId: string;
  projectId: string;
  statuses: Status[];
  members: AppUser[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const me = useCurrentUser();

  const tasksKey = queryKeys.tasks.all(projectId);

  // Pull the task from the cached board list when possible; otherwise fetch.
  const { data: task, isLoading } = useQuery<Task | null>({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: async () => {
      const cached = queryClient.getQueryData<Task[]>(tasksKey)?.find((t) => t.id === taskId);
      if (cached) return cached;
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, project_id, title, description, status_id, assigned_to, created_by, priority, due_date, position, created_at, updated_at',
        )
        .eq('id', taskId)
        .maybeSingle();
      if (error) throw error;
      return (data as Task | null) ?? null;
    },
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  const statusNameById = new Map(statuses.map((s) => [s.id, s.name]));

  if (isLoading || !task) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function applyPatch(patch: Record<string, unknown>) {
    const result = await updateTaskAction({ taskId, ...patch });
    if (!result.ok) {
      toast.error('Update failed', { description: result.error.message });
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    const result = await deleteTaskAction({ taskId, projectId });
    if (!result.ok) {
      toast.error('Could not delete', { description: result.error.message });
      return;
    }
    toast.success('Task deleted');
    router.replace(`/projects/${projectId}/board`, { scroll: false });
  }

  return (
    <div className="grid max-h-[90vh] grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Task</DialogTitle>
          <DialogDescription className="sr-only">Task detail and comments.</DialogDescription>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && applyPatch({ title: title.trim() })}
            className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            maxLength={300}
          />
        </DialogHeader>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? '') && applyPatch({ description })}
            placeholder="Add a description…"
            className="min-h-[120px]"
            maxLength={20000}
          />
        </div>

        <hr />
        <CommentThread taskId={taskId} members={members} />
      </div>

      <aside className="space-y-4 text-sm">
        <Field label="Status">
          <select
            value={task.status_id}
            onChange={(e) => applyPatch({ statusId: e.target.value })}
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assignee">
          <select
            value={task.assigned_to ?? ''}
            onChange={(e) =>
              applyPatch({ assignedTo: e.target.value === '' ? null : e.target.value })
            }
            className="h-9 w-full rounded-md border bg-background px-2"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? m.email}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            value={task.priority}
            onChange={(e) => applyPatch({ priority: e.target.value as TaskPriority })}
            className="h-9 w-full rounded-md border bg-background px-2 capitalize"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due date">
          <Input
            type="date"
            value={task.due_date ?? ''}
            onChange={(e) =>
              applyPatch({ dueDate: e.target.value === '' ? null : e.target.value })
            }
          />
        </Field>

        <ProjectRoleGate projectId={projectId} allow={['pm']}>
          <Button variant="outline" size="sm" onClick={handleDelete} className="w-full">
            <Trash2 className="h-3.5 w-3.5" /> Delete task
          </Button>
        </ProjectRoleGate>

        <div>
          <Label className="text-xs text-muted-foreground">Activity</Label>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-card p-3">
            <ActivityFeed
              taskId={taskId}
              members={members}
              statusNameById={statusNameById}
            />
          </div>
        </div>

        {me?.id === task.created_by ? (
          <p className="text-[10px] text-muted-foreground">You created this task.</p>
        ) : null}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
