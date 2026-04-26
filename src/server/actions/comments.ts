'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/getCurrentUser';
import { wrapAction } from '@/lib/auth/actionResult';
import {
  CreateCommentSchema,
  UpdateCommentSchema,
  DeleteCommentSchema,
  type CreateCommentInput,
} from '@/lib/validation/comment';

/** Add a comment. RLS verifies the user can see the parent task. */
export async function createCommentAction(input: CreateCommentInput) {
  return wrapAction(async () => {
    const user = await requireUser();
    const data = CreateCommentSchema.parse(input);
    const supabase = await createClient();

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        task_id: data.taskId,
        body: data.body,
        parent_id: data.parentId ?? null,
        author_id: user.id,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    return { id: comment.id as string };
  });
}

export async function updateCommentAction(input: { commentId: string; body: string }) {
  return wrapAction(async () => {
    await requireUser();
    const data = UpdateCommentSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase
      .from('comments')
      .update({ body: data.body })
      .eq('id', data.commentId);
    if (error) throw new Error(error.message);
  });
}

export async function deleteCommentAction(input: { commentId: string }) {
  return wrapAction(async () => {
    await requireUser();
    const data = DeleteCommentSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.from('comments').delete().eq('id', data.commentId);
    if (error) throw new Error(error.message);
  });
}
