'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/getCurrentUser';
import { wrapAction } from '@/lib/auth/actionResult';
import {
  CreateStatusSchema,
  UpdateStatusSchema,
  ReorderStatusesSchema,
  DeleteStatusSchema,
} from '@/lib/validation/workflow';

/**
 * Create a new status (column) in a workflow. Admin only.
 * Position is appended to the end; reorder via `reorderStatusesAction`.
 */
export async function createStatusAction(input: {
  workflowId: string;
  name: string;
  color?: string;
  isTerminal?: boolean;
}) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = CreateStatusSchema.parse({
      workflowId: input.workflowId,
      status: {
        name: input.name,
        position: 0, // overwritten below
        color: input.color ?? '#6B7280',
        isTerminal: input.isTerminal ?? false,
      },
    });

    const { data: last } = await supabaseService
      .from('statuses')
      .select('position')
      .eq('workflow_id', data.workflowId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (last?.position ?? -1) + 1;

    const { data: created, error } = await supabaseService
      .from('statuses')
      .insert({
        workflow_id: data.workflowId,
        name: data.status.name,
        position,
        color: data.status.color,
        is_terminal: data.status.isTerminal,
      })
      .select('id, workflow_id')
      .single();
    if (error) throw new Error(error.message);

    const { data: workflow } = await supabaseService
      .from('workflows')
      .select('project_id')
      .eq('id', created.workflow_id)
      .single();

    if (workflow?.project_id) revalidatePath(`/projects/${workflow.project_id}`);
    return { id: created.id as string };
  });
}

export async function updateStatusAction(input: {
  statusId: string;
  patch: { name?: string; color?: string; isTerminal?: boolean };
}) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = UpdateStatusSchema.parse(input);

    const dbPatch: Record<string, unknown> = {};
    if (data.patch.name !== undefined) dbPatch.name = data.patch.name;
    if (data.patch.color !== undefined) dbPatch.color = data.patch.color;
    if (data.patch.isTerminal !== undefined) dbPatch.is_terminal = data.patch.isTerminal;

    if (Object.keys(dbPatch).length === 0) return;

    const { data: updated, error } = await supabaseService
      .from('statuses')
      .update(dbPatch)
      .eq('id', data.statusId)
      .select('workflow_id')
      .single();
    if (error) throw new Error(error.message);

    const { data: workflow } = await supabaseService
      .from('workflows')
      .select('project_id')
      .eq('id', updated.workflow_id)
      .single();
    if (workflow?.project_id) revalidatePath(`/projects/${workflow.project_id}`);
  });
}

/**
 * Reorder statuses atomically using the `reorder_statuses` RPC. Admin only.
 * The RPC defers the (workflow_id, position) unique constraint so we can
 * pass intermediate-collision states.
 */
export async function reorderStatusesAction(input: {
  workflowId: string;
  ordered: Array<{ id: string; position: number }>;
}) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = ReorderStatusesSchema.parse(input);

    const supabase = await createClient();
    const { error } = await supabase.rpc('reorder_statuses', {
      p_workflow_id: data.workflowId,
      p_orders: data.ordered.map((o) => ({ id: o.id, position: o.position })),
    });
    if (error) throw new Error(error.message);

    const { data: workflow } = await supabaseService
      .from('workflows')
      .select('project_id')
      .eq('id', data.workflowId)
      .single();
    if (workflow?.project_id) revalidatePath(`/projects/${workflow.project_id}`);
  });
}

/**
 * Delete a status. If the status has tasks, `migrateToStatusId` must be
 * provided — the RPC moves tasks before the FK RESTRICT can fire.
 * Admin only.
 */
export async function deleteStatusAction(input: {
  statusId: string;
  migrateToStatusId?: string;
}) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = DeleteStatusSchema.parse(input);

    if (data.migrateToStatusId) {
      const supabase = await createClient();
      const { error: rpcErr } = await supabase.rpc('migrate_status_tasks', {
        p_from_status_id: data.statusId,
        p_to_status_id: data.migrateToStatusId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
    }

    const { data: deleted, error } = await supabaseService
      .from('statuses')
      .delete()
      .eq('id', data.statusId)
      .select('workflow_id')
      .single();
    if (error) throw new Error(error.message);

    const { data: workflow } = await supabaseService
      .from('workflows')
      .select('project_id')
      .eq('id', deleted.workflow_id)
      .single();
    if (workflow?.project_id) revalidatePath(`/projects/${workflow.project_id}`);
  });
}
