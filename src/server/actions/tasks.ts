'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, requireProjectPM } from '@/lib/auth/getCurrentUser';
import { wrapAction } from '@/lib/auth/actionResult';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  DeleteTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type MoveTaskInput,
} from '@/lib/validation/task';
import { computeFractionalPosition, ReindexRequiredError, FRACTIONAL } from '@/lib/ordering/fractional';

/** Create a task. Any project member (or admin) may call. */
export async function createTaskAction(input: CreateTaskInput) {
  return wrapAction(async () => {
    const user = await requireUser();
    const data = CreateTaskSchema.parse(input);
    const supabase = await createClient();

    // Append: 1024 above the highest existing position in the column.
    const { data: last } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', data.projectId)
      .eq('status_id', data.statusId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (last?.position ?? 0) + FRACTIONAL.STEP;

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        project_id: data.projectId,
        title: data.title,
        description: data.description ?? null,
        status_id: data.statusId,
        assigned_to: data.assignedTo ?? null,
        priority: data.priority,
        due_date: data.dueDate ?? null,
        created_by: user.id,
        position,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    revalidatePath(`/projects/${data.projectId}/board`);
    revalidatePath(`/projects/${data.projectId}/list`);
    return { id: task.id as string };
  });
}

export async function updateTaskAction(input: UpdateTaskInput) {
  return wrapAction(async () => {
    await requireUser();
    const data = UpdateTaskSchema.parse(input);
    const supabase = await createClient();

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.statusId !== undefined) patch.status_id = data.statusId;
    if (data.assignedTo !== undefined) patch.assigned_to = data.assignedTo;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.due_date = data.dueDate;

    if (Object.keys(patch).length === 0) return;

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', data.taskId)
      .select('project_id')
      .single();
    if (error) throw new Error(error.message);

    revalidatePath(`/projects/${updated.project_id}/board`);
    revalidatePath(`/projects/${updated.project_id}/list`);
  });
}

/**
 * Move a task — used by the Kanban DnD handler.
 * Computes fractional position; auto-reindexes the column if gaps converge.
 */
export async function moveTaskAction(input: MoveTaskInput & { projectId: string }) {
  return wrapAction(async () => {
    await requireUser();
    const data = MoveTaskSchema.parse(input);
    const supabase = await createClient();

    let position: number;
    try {
      position = await computeFractionalPosition(supabase, {
        projectId: input.projectId,
        toStatusId: data.toStatusId,
        beforeTaskId: data.beforeTaskId,
        afterTaskId: data.afterTaskId,
      });
    } catch (err) {
      if (err instanceof ReindexRequiredError) {
        // Reindex the destination column, then retry once.
        const { error: rxErr } = await supabase.rpc('reindex_column_positions', {
          p_project_id: input.projectId,
          p_status_id: data.toStatusId,
        });
        if (rxErr) throw new Error(rxErr.message);

        position = await computeFractionalPosition(supabase, {
          projectId: input.projectId,
          toStatusId: data.toStatusId,
          beforeTaskId: data.beforeTaskId,
          afterTaskId: data.afterTaskId,
        });
      } else {
        throw err;
      }
    }

    const { error } = await supabase
      .from('tasks')
      .update({ status_id: data.toStatusId, position })
      .eq('id', data.taskId);
    if (error) throw new Error(error.message);

    // Skip revalidatePath here — Realtime broadcast updates other clients,
    // and the moving client has already applied the optimistic update.
  });
}

/** Delete a task. Admin or project PM only (RLS-enforced). */
export async function deleteTaskAction(input: { taskId: string; projectId: string }) {
  return wrapAction(async () => {
    await requireUser();
    const data = DeleteTaskSchema.parse(input);
    // Pre-check for friendly error
    await requireProjectPM(data.projectId);

    const supabase = await createClient();
    const { error } = await supabase.from('tasks').delete().eq('id', data.taskId);
    if (error) throw new Error(error.message);

    revalidatePath(`/projects/${data.projectId}/board`);
    revalidatePath(`/projects/${data.projectId}/list`);
  });
}
