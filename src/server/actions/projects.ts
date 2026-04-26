'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { requireRole, requireProjectPM } from '@/lib/auth/getCurrentUser';
import { wrapAction } from '@/lib/auth/actionResult';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  AddMemberSchema,
  RemoveMemberSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/lib/validation/project';

/**
 * Create a project. Admin only.
 *
 * Trigger `tg_init_project_workflow` will:
 *   • create the workflow with default Todo/In Progress/Review/Done columns
 *   • add the creator as a PM
 * We then upsert any additional PMs and members.
 */
export async function createProjectAction(input: CreateProjectInput) {
  return wrapAction(async () => {
    const admin = await requireRole(['admin']);
    const data = CreateProjectSchema.parse(input);

    const { data: project, error } = await supabaseService
      .from('projects')
      .insert({
        name: data.name,
        description: data.description ?? null,
        created_by: admin.id,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const memberRows = [
      ...data.pmIds.map((user_id) => ({
        project_id: project.id,
        user_id,
        role: 'pm' as const,
        added_by: admin.id,
      })),
      ...data.memberIds
        .filter((id) => !data.pmIds.includes(id))
        .map((user_id) => ({
          project_id: project.id,
          user_id,
          role: 'member' as const,
          added_by: admin.id,
        })),
    ];

    if (memberRows.length > 0) {
      const { error: mErr } = await supabaseService
        .from('project_members')
        .upsert(memberRows, { onConflict: 'project_id,user_id' });
      if (mErr) throw new Error(mErr.message);
    }

    revalidatePath('/projects');
    revalidatePath('/admin/projects');
    return { id: project.id as string };
  });
}

export async function updateProjectAction(input: UpdateProjectInput) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const data = UpdateProjectSchema.parse(input);

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.archived !== undefined) {
      patch.archived_at = data.archived ? new Date().toISOString() : null;
    }

    const { error } = await supabaseService
      .from('projects')
      .update(patch)
      .eq('id', data.projectId);
    if (error) throw new Error(error.message);

    revalidatePath('/projects');
    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath('/admin/projects');
  });
}

export async function deleteProjectAction(projectId: string) {
  return wrapAction(async () => {
    await requireRole(['admin']);
    const { error } = await supabaseService.from('projects').delete().eq('id', projectId);
    if (error) throw new Error(error.message);
    revalidatePath('/projects');
    revalidatePath('/admin/projects');
  });
}

/**
 * Add a member to a project. Admins may add any role.
 * PMs may only add `member` (also enforced by RLS, but checked here for fast feedback).
 */
export async function addProjectMemberAction(input: {
  projectId: string;
  userId: string;
  role?: 'pm' | 'member';
}) {
  return wrapAction(async () => {
    const data = AddMemberSchema.parse(input);
    const supabase = await createClient();

    // Anything but admin assigning a non-member role gets rejected here too.
    if (data.role === 'pm') {
      await requireRole(['admin']);
    } else {
      await requireProjectPM(data.projectId);
    }

    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: data.projectId, user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);

    revalidatePath(`/projects/${data.projectId}/settings`);
  });
}

export async function removeProjectMemberAction(input: {
  projectId: string;
  userId: string;
}) {
  return wrapAction(async () => {
    const data = RemoveMemberSchema.parse(input);
    const supabase = await createClient();
    // RLS: admin OR (PM removing a 'member'). Fast pre-check:
    await requireProjectPM(data.projectId);

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', data.projectId)
      .eq('user_id', data.userId);
    if (error) throw new Error(error.message);

    revalidatePath(`/projects/${data.projectId}/settings`);
    revalidatePath(`/projects/${data.projectId}/board`);
  });
}
